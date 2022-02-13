import {useReactMediaRecorder} from "react-media-recorder";
import {SlIconButton, SlButton} from "@shoelace-style/shoelace/dist/react";
import styled from "styled-components";
import {HTMLAttributes, useCallback, useEffect, useMemo} from "react";

const RecordButton = styled(SlIconButton)<{ color: string }>`
  font-size: 4rem;

  ::part(base) {
    color: ${(props) => props.color};
  }
`;

const RootContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

interface Props {
  onDone: (blob: Blob) => void;
}

export function AudioRecorder(props: Props & HTMLAttributes<HTMLDivElement>) {
  const {onDone, ...domProps} = props;
  const {
    status,
    startRecording,
    stopRecording,
    resumeRecording,
    pauseRecording,
    mediaBlobUrl,
  } = useReactMediaRecorder({video: false, audio: true});

  const recordButtonProps = useMemo(() => {
    if (status === 'recording') {
      return {
        icon: 'pause-circle',
        onClick: pauseRecording,
        color: 'var(--sl-color-danger-300)',
      };
    }

    if (status === 'paused') {
      return {
        icon: 'skip-forward-circle',
        onClick: resumeRecording,
        color: 'var(--sl-color-warning-300)',
      };
    }

    return {
      icon: 'record-circle',
      onClick: startRecording,
      color: 'var(--sl-neutral-300)',
    };
  }, [status]);

  const sendBlobToParent = useCallback(async () => {
    if (status !== 'stopped' || !mediaBlobUrl) {
      return;
    }

    const blob = await fetch(mediaBlobUrl).then((res) => res.blob());
    onDone(blob);
  }, [status, mediaBlobUrl]);

  useEffect(() => {
    sendBlobToParent()
  }, [sendBlobToParent]);

  return (
    <RootContainer {...domProps}>
      <RecordButton onClick={recordButtonProps.onClick}
                    name={recordButtonProps.icon}
                    color={recordButtonProps.color}
      />

      {status !== 'idle' && (<>
        <SlButton onClick={stopRecording} variant={'text'} size={'large'}>Fertig 😅</SlButton>
      </>)}
    </RootContainer>
  );
}
