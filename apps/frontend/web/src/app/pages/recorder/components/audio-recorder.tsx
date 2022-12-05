/// <reference types="webrtc" />

import {SlIconButton, SlButton} from "@shoelace-style/shoelace/dist/react";
import styled from "styled-components";
import {HTMLAttributes, useCallback, useEffect, useMemo, useState} from "react";
import {RecordRTCPromisesHandler} from "recordrtc";
import {formatSeconds as formatSecondsRaw} from "../../../../utils/time";

const RecordButton = styled(SlIconButton)<{ color: string, isRecording: boolean }>`
  font-size: 4rem;
  animation: ${(props) => props.isRecording ? "pulse 1s infinite" : "none"};

  ::part(base) {
    color: ${(props) => props.color};
  }

  @keyframes pulse {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.1);
    }
    100% {
      transform: scale(1);
    }
  }
`;

const RootContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

interface Props {
  onDone: (audioFile: Blob) => void;
}

type RecorderStates = "idle" | "recording" | 'paused' | "stopped";

export function AudioRecorder(props: Props & HTMLAttributes<HTMLDivElement>) {
  const {onDone, ...domProps} = props;

  const [recorder, setRecorder] = useState<RecordRTCPromisesHandler | null>(null);
  const [status, setStatus] = useState<RecorderStates>('idle');
  const [recordedDuration, setRecordedDuration] = useState<number>(0);

  const initRecorder = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({video: false, audio: true});
    setRecorder(new RecordRTCPromisesHandler(stream, {
      type: 'audio',
      mimeType: 'audio/webm',
    }));
  }, [setRecorder]);

  useEffect(() => {
    const clearCallbacks: Array<() => void> = [];
    if (status === 'recording') {
      const updateInterval = setInterval(() => {
        if (status === "recording") {
          setRecordedDuration(recordedDuration + 1);
        }
      }, 1000);

      clearCallbacks.push(() => clearInterval(updateInterval));
    }

    if (status === 'stopped') {
      setRecordedDuration(0);
    }

    return () => {
      clearCallbacks.forEach((callback) => callback());
    };
  }, [status, recordedDuration, setRecordedDuration]);

  const recordButtonProps = useMemo(() => {
    if (!recorder) {
      return null;
    }

    if (status === 'recording') {
      return {
        icon: 'pause-circle',
        onClick: async () => {
          await recorder.pauseRecording();
          setStatus('paused');
        },
        color: 'var(--sl-color-danger-300)',
      };
    }

    if (status === 'paused') {
      return {
        icon: 'skip-forward-circle',
        onClick: async () => {
          await recorder.resumeRecording();
          setStatus('recording');
        },
        color: 'var(--sl-color-warning-300)',
      };
    }

    return {
      icon: 'record-circle',
      onClick: async () => {
        await recorder.startRecording();
        setStatus('recording');
      },
      color: 'var(--sl-neutral-300)',
    };
  }, [status, recorder]);

  const finishRecording = useCallback(async () => {
    if (!recorder) {
      return;
    }

    await recorder.stopRecording();
    setStatus('stopped');

    const audioBlob = await recorder.getBlob();

    onDone(audioBlob);

    setStatus('idle');
  }, [recorder, setStatus, onDone]);

  const formatSeconds = useCallback((seconds: number) => {
    return formatSecondsRaw(seconds);
  }, []);

  return (
    <RootContainer {...domProps}>
      {!recorder && <SlButton onClick={initRecorder}>Ja, Bob darf zuhören... 🎙</SlButton>}
      {recordButtonProps && (<>
        <small>{formatSeconds(recordedDuration)}</small>
        <RecordButton onClick={recordButtonProps.onClick}
                      name={recordButtonProps.icon}
                      color={recordButtonProps.color}
                      isRecording={status === 'recording'}
        />
      </>)}

      {status !== 'idle' && (
        <SlButton variant={'text'}
                  size={'large'}
                  onClick={finishRecording}
        >
          Fertig 😅
        </SlButton>
      )}
    </RootContainer>
  );
}
