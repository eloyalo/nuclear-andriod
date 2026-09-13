const DROPPED_QUALIFIERS: &[&str] = &["remaster"];

fn is_dropped_qualifier(text: &str) -> bool {
    let lowercase = text.to_lowercase();
    DROPPED_QUALIFIERS
        .iter()
        .any(|qualifier| lowercase.contains(qualifier))
}

fn closing_bracket(opening: char) -> Option<char> {
    match opening {
        '(' => Some(')'),
        '[' => Some(']'),
        _ => None,
    }
}

fn remove_bracketed_qualifiers(text: &str) -> String {
    let mut result = String::with_capacity(text.len());
    let mut rest = text;

    while let Some((start, opening)) = rest.char_indices().find(|(_, c)| closing_bracket(*c).is_some()) {
        let closing = closing_bracket(opening).unwrap_or(')');
        let after_opening = &rest[start + opening.len_utf8()..];

        match after_opening.find(closing) {
            Some(end) => {
                let inner = &after_opening[..end];
                result.push_str(&rest[..start]);
                if !is_dropped_qualifier(inner) {
                    result.push(opening);
                    result.push_str(inner);
                    result.push(closing);
                }
                rest = &after_opening[end + closing.len_utf8()..];
            }
            None => break,
        }
    }

    result.push_str(rest);
    result
}

pub fn clean_search_query(query: &str) -> String {
    let unquoted = query.replace('"', " ");
    let without_brackets = remove_bracketed_qualifiers(&unquoted);

    let kept: Vec<&str> = without_brackets
        .split(" - ")
        .enumerate()
        .filter(|(index, part)| *index == 0 || !is_dropped_qualifier(part))
        .map(|(_, part)| part)
        .collect();

    kept.join(" - ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn take_until_delimiter(text: &str) -> &str {
    let end = text.find(['&', '?', '#', '/']).unwrap_or(text.len());
    &text[..end]
}

pub fn video_id_from_url(url: &str) -> String {
    let trimmed = url.trim();

    for marker in ["v=", "youtu.be/", "/shorts/"] {
        if let Some(position) = trimmed.find(marker) {
            return take_until_delimiter(&trimmed[position + marker.len()..]).to_string();
        }
    }

    trimmed.to_string()
}

const VISITOR_DATA_MARKER: &str = "\"VISITOR_DATA\":\"";
const PLAYABLE_STATUS: &str = "OK";
const BOT_CHECK_STATUS: &str = "LOGIN_REQUIRED";

pub fn extract_visitor_data(html: &str) -> Option<String> {
    let start = html.find(VISITOR_DATA_MARKER)? + VISITOR_DATA_MARKER.len();
    let length = html[start..].find('"')?;
    let value = &html[start..start + length];
    (!value.is_empty()).then(|| value.to_string())
}

#[derive(Debug, PartialEq)]
pub struct PlayerAudio {
    pub url: String,
    pub mime_type: String,
    pub bitrate: u64,
    pub container: Option<String>,
    pub codec: Option<String>,
    pub duration_seconds: Option<f64>,
    pub title: Option<String>,
}

fn container_from_mime(mime_type: &str) -> Option<String> {
    let subtype = mime_type.split(';').next()?.split('/').nth(1)?.trim();
    match subtype {
        "mp4" => Some("m4a".to_string()),
        "" => None,
        other => Some(other.to_string()),
    }
}

fn codec_from_mime(mime_type: &str) -> Option<String> {
    let marker = "codecs=\"";
    let start = mime_type.find(marker)? + marker.len();
    let length = mime_type[start..].find('"')?;
    Some(mime_type[start..start + length].to_string())
}

pub fn is_bot_check(player: &serde_json::Value) -> bool {
    player["playabilityStatus"]["status"].as_str() == Some(BOT_CHECK_STATUS)
}

pub fn best_audio_from_player(player: &serde_json::Value) -> Result<PlayerAudio, String> {
    let status = player["playabilityStatus"]["status"]
        .as_str()
        .unwrap_or("UNKNOWN");
    if status != PLAYABLE_STATUS {
        let reason = player["playabilityStatus"]["reason"]
            .as_str()
            .unwrap_or(status);
        return Err(format!("YouTube refused playback: {}", reason));
    }

    let formats = player["streamingData"]["adaptiveFormats"]
        .as_array()
        .ok_or_else(|| "No streaming data returned by YouTube".to_string())?;

    let best = formats
        .iter()
        .filter(|format| {
            format["mimeType"]
                .as_str()
                .is_some_and(|mime| mime.starts_with("audio/"))
                && format["url"].is_string()
        })
        .max_by_key(|format| format["bitrate"].as_u64().unwrap_or(0))
        .ok_or_else(|| "No directly playable audio returned by YouTube".to_string())?;

    let mime_type = best["mimeType"].as_str().unwrap_or_default().to_string();

    Ok(PlayerAudio {
        url: best["url"].as_str().unwrap_or_default().to_string(),
        bitrate: best["bitrate"].as_u64().unwrap_or(0),
        container: container_from_mime(&mime_type),
        codec: codec_from_mime(&mime_type),
        mime_type,
        duration_seconds: player["videoDetails"]["lengthSeconds"]
            .as_str()
            .and_then(|seconds| seconds.parse().ok()),
        title: player["videoDetails"]["title"].as_str().map(str::to_string),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    mod extract_visitor_data_tests {
        use super::*;

        #[test]
        fn reads_value_from_ytcfg() {
            let html = r#"<script>ytcfg.set({"INNERTUBE_API_KEY":"x","VISITOR_DATA":"CgtABC%3D%3D","HL":"en"});</script>"#;
            assert_eq!(extract_visitor_data(html), Some("CgtABC%3D%3D".to_string()));
        }

        #[test]
        fn returns_none_when_missing_or_empty() {
            assert_eq!(extract_visitor_data("<html></html>"), None);
            assert_eq!(extract_visitor_data(r#"{"VISITOR_DATA":""}"#), None);
        }
    }

    mod best_audio_from_player_tests {
        use super::*;

        fn playable(formats: serde_json::Value) -> serde_json::Value {
            json!({
                "playabilityStatus": { "status": "OK" },
                "videoDetails": { "title": "SAD!", "lengthSeconds": "167" },
                "streamingData": { "adaptiveFormats": formats },
            })
        }

        #[test]
        fn picks_highest_bitrate_audio_with_a_direct_url() {
            let player = playable(json!([
                { "itag": 137, "mimeType": "video/mp4; codecs=\"avc1\"", "bitrate": 4000000, "url": "https://video" },
                { "itag": 140, "mimeType": "audio/mp4; codecs=\"mp4a.40.2\"", "bitrate": 130533, "url": "https://m4a" },
                { "itag": 251, "mimeType": "audio/webm; codecs=\"opus\"", "bitrate": 138734, "url": "https://opus" },
                { "itag": 999, "mimeType": "audio/webm; codecs=\"opus\"", "bitrate": 999999, "signatureCipher": "s=abc" },
            ]));

            assert_eq!(
                best_audio_from_player(&player),
                Ok(PlayerAudio {
                    url: "https://opus".to_string(),
                    mime_type: "audio/webm; codecs=\"opus\"".to_string(),
                    bitrate: 138734,
                    container: Some("webm".to_string()),
                    codec: Some("opus".to_string()),
                    duration_seconds: Some(167.0),
                    title: Some("SAD!".to_string()),
                })
            );
        }

        #[test]
        fn names_mp4_audio_as_m4a() {
            let player = playable(json!([
                { "mimeType": "audio/mp4; codecs=\"mp4a.40.2\"", "bitrate": 1, "url": "https://m4a" },
            ]));

            let audio = best_audio_from_player(&player).unwrap();
            assert_eq!(audio.container.as_deref(), Some("m4a"));
            assert_eq!(audio.codec.as_deref(), Some("mp4a.40.2"));
        }

        #[test]
        fn reports_the_refusal_reason() {
            let player = json!({
                "playabilityStatus": { "status": "LOGIN_REQUIRED", "reason": "Sign in to confirm you're not a bot" },
            });

            assert!(is_bot_check(&player));
            assert_eq!(
                best_audio_from_player(&player),
                Err("YouTube refused playback: Sign in to confirm you're not a bot".to_string())
            );
        }

        #[test]
        fn fails_without_directly_playable_audio() {
            let player = playable(json!([
                { "mimeType": "audio/webm; codecs=\"opus\"", "bitrate": 1, "signatureCipher": "s=abc" },
            ]));

            assert!(!is_bot_check(&player));
            assert_eq!(
                best_audio_from_player(&player),
                Err("No directly playable audio returned by YouTube".to_string())
            );
        }
    }

    mod clean_search_query_tests {
        use super::*;

        #[test]
        fn strips_quotes() {
            assert_eq!(
                clean_search_query(r#"Radiohead "Creep""#),
                "Radiohead Creep"
            );
        }

        #[test]
        fn drops_dash_remaster_suffix() {
            assert_eq!(
                clean_search_query(r#"Queen "Bohemian Rhapsody - Remastered 2011""#),
                "Queen Bohemian Rhapsody"
            );
        }

        #[test]
        fn drops_bracketed_remaster_suffix() {
            assert_eq!(
                clean_search_query("The Beatles Help! (Remastered 2009)"),
                "The Beatles Help!"
            );
            assert_eq!(
                clean_search_query("Pink Floyd Time [2011 Remaster]"),
                "Pink Floyd Time"
            );
        }

        #[test]
        fn keeps_qualifiers_that_change_the_recording() {
            assert_eq!(
                clean_search_query("Daft Punk One More Time - Radio Edit"),
                "Daft Punk One More Time - Radio Edit"
            );
            assert_eq!(
                clean_search_query("Radiohead Creep (Acoustic)"),
                "Radiohead Creep (Acoustic)"
            );
        }

        #[test]
        fn never_drops_the_leading_part() {
            assert_eq!(
                clean_search_query("Remastered Artist - Song"),
                "Remastered Artist - Song"
            );
        }

        #[test]
        fn keeps_unbalanced_brackets() {
            assert_eq!(clean_search_query("Song (Remastered"), "Song (Remastered");
        }

        #[test]
        fn handles_non_ascii_text() {
            assert_eq!(
                clean_search_query(r#"ROSALÍA "DESPECHÁ (Remastered)""#),
                "ROSALÍA DESPECHÁ"
            );
        }
    }

    mod video_id_from_url_tests {
        use super::*;

        #[test]
        fn reads_watch_urls() {
            assert_eq!(
                video_id_from_url("https://www.youtube.com/watch?v=FGBhQbmPwH8&list=abc"),
                "FGBhQbmPwH8"
            );
        }

        #[test]
        fn reads_short_urls() {
            assert_eq!(
                video_id_from_url("https://youtu.be/FGBhQbmPwH8?t=10"),
                "FGBhQbmPwH8"
            );
        }

        #[test]
        fn reads_shorts_urls() {
            assert_eq!(
                video_id_from_url("https://www.youtube.com/shorts/FGBhQbmPwH8"),
                "FGBhQbmPwH8"
            );
        }

        #[test]
        fn passes_bare_ids_through() {
            assert_eq!(video_id_from_url(" FGBhQbmPwH8 "), "FGBhQbmPwH8");
        }
    }
}
