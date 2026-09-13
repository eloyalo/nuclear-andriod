import { render } from '@testing-library/react';

import { classifyHlsError } from '../hooks/useHlsSource';
import { Sound } from '../Sound';
import { AudioSource } from '../types';
import { setupAudioContextMock } from './test-utils';

const directSource: AudioSource = {
  url: 'http://127.0.0.1:9100/stream/expired',
  protocol: 'https',
};

const MEDIA_ERR_DECODE = 3;
const MEDIA_ERR_SRC_NOT_SUPPORTED = 4;
const HAVE_NOTHING = 0;
const HAVE_ENOUGH_DATA = 4;

const failAudioElement = (code: number, readyState: number) => {
  const audio = document.querySelector('audio') as HTMLAudioElement;
  Object.defineProperty(audio, 'error', { value: { code, message: '' } });
  Object.defineProperty(audio, 'readyState', { value: readyState });
  audio.dispatchEvent(new Event('error'));
};

describe('classifyHlsError', () => {
  it('treats a playlist the server now refuses as an invalid source', () => {
    expect(classifyHlsError({ fatal: true, response: { code: 403 } })).toBe(
      'sourceInvalid',
    );
    expect(classifyHlsError({ fatal: true, response: { code: 410 } })).toBe(
      'sourceInvalid',
    );
  });

  it('treats other fatal failures as playback errors', () => {
    expect(classifyHlsError({ fatal: true })).toBe('playbackError');
    expect(classifyHlsError({ fatal: true, response: { code: 500 } })).toBe(
      'playbackError',
    );
  });

  it('leaves failures that are not fatal to hls.js, which retries them', () => {
    expect(classifyHlsError({ fatal: false, response: { code: 403 } })).toBe(
      'ignore',
    );
  });
});

describe('Sound with a direct stream', () => {
  let restoreAudioContext: () => void;

  beforeEach(() => {
    restoreAudioContext = setupAudioContextMock().restore;
  });

  afterEach(() => {
    restoreAudioContext();
  });

  it('reports a stream that never loaded as an invalid source', () => {
    const onSourceInvalid = vi.fn();
    const onError = vi.fn();
    render(
      <Sound
        src={directSource}
        status="playing"
        onSourceInvalid={onSourceInvalid}
        onError={onError}
      />,
    );

    failAudioElement(MEDIA_ERR_SRC_NOT_SUPPORTED, HAVE_NOTHING);

    expect(onSourceInvalid).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('reports a failure after audio had loaded as a playback error', () => {
    const onSourceInvalid = vi.fn();
    const onError = vi.fn();
    render(
      <Sound
        src={directSource}
        status="playing"
        onSourceInvalid={onSourceInvalid}
        onError={onError}
      />,
    );

    failAudioElement(MEDIA_ERR_DECODE, HAVE_ENOUGH_DATA);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onSourceInvalid).not.toHaveBeenCalled();
  });
});
