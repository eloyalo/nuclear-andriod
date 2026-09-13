// Metadata providers sometimes return text with HTML escaped in it (e.g. "Rauf &amp; Faik").
// Parsing as an inert document decodes the entities and drops any tags without running scripts.
export const decodeHtmlEntities = (text: string): string => {
  if (!text.includes('&') && !text.includes('<')) {
    return text;
  }
  return (
    new DOMParser().parseFromString(text, 'text/html').documentElement
      .textContent ?? text
  );
};
