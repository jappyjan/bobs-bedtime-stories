import {usePlayer} from "../../../state/player.state";
import {
  SlButton,
  SlButtonGroup,
  SlDrawer,
  SlIcon, SlProgressBar,
  SlRange,
} from "@shoelace-style/shoelace/dist/react";
import styled from "styled-components";
import {useCallback} from "react";
import {formatSeconds} from "../../../utils/time";

const Header = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  width: 100%;
  flex-wrap: wrap;
`;

const NowPlayingTitle = styled.div`
  flex-grow: 1;
  margin-bottom: 1.5rem;
`;

const NowPlayingBookTitle = styled.h2`
  margin-top: 0;
  font-size: var(--sl-font-size-2x-large);
`;

const NowPlayingEpisodeTitle = styled.h3`
  margin-top: 0;
  font-size: var(--sl-font-size-large);
`;

const PlayerControlButtons = styled(SlButtonGroup)`
  flex-shrink: 1;
`;

const ActionButton = styled(SlButton)`
  font-size: 2rem;
`;

const SeekBarContainer = styled.div`
  display: flex;
  flex-direction: row;
  margin-top: 3rem;
`;

const SeekbarCurrentTime = styled.span`
  flex-shrink: 1;
  font-family: var(--sl-font-mono);
`;

const SeekBar = styled(SlRange)`
  flex-grow: 1;
  padding: 0 1rem;
`;

const SeekbarRemainingTime = styled.span`
  flex-shrink: 1;
  font-family: var(--sl-font-mono);
`;

export function Player() {
  const player = usePlayer();

  const handleSeekbarChange = useCallback((e: Event) => {
    const eventValue = (e.target! as HTMLInputElement).value;
    player.seekTo(Number(eventValue));
  }, [player]);

  const seekBackward = useCallback(() => {
    let newSeekPosition = player.seekPosition - 10;
    if (newSeekPosition < 0) {
      newSeekPosition = 0;
    }
    player.seekTo(newSeekPosition);
  }, [player]);

  const seekForward = useCallback(() => {
    let newSeekPosition = player.seekPosition + 10;
    if (newSeekPosition > (player?.audioLength ?? 0)) {
      newSeekPosition = player?.audioLength ?? 0;
    }
    player.seekTo(newSeekPosition);
  }, [player]);

  return (
    <SlDrawer label="Aktuell läuft..."
              placement="bottom"
              open={player.showPlayer}
              onSlAfterHide={() => player.setPlayerVisibility(false)}
    >
      {!player.nowPlaying && "Zu blöd... ist ja still hier 🐹"}
      {player.nowPlaying && (<>
        <Header>
          <NowPlayingTitle>
            <NowPlayingBookTitle>{player.nowPlaying.book.title}</NowPlayingBookTitle>
            <NowPlayingEpisodeTitle>Episode {player.nowPlaying.episode}</NowPlayingEpisodeTitle>
          </NowPlayingTitle>

          {!player.isLoading && (
            <PlayerControlButtons>
              <ActionButton name="-10Sek." onClick={seekBackward}>
                <SlIcon name="skip-backward"/>
              </ActionButton>
              {player.state === 'paused' && (
                <ActionButton name="play" onClick={() => player.play()}>
                  <SlIcon name="play"/>
                </ActionButton>
              )}
              {player.state === 'playing' && (
                <ActionButton name="pause" onClick={() => player.pause()}>
                  <SlIcon name="pause"/>
                </ActionButton>
              )}
              <ActionButton name="+10Sek." onClick={seekForward}>
                <SlIcon name="skip-forward"/>
              </ActionButton>
            </PlayerControlButtons>
          )}
        </Header>

        {player.isLoading ? (
          <SlProgressBar indeterminate />
        ) : (
          <SeekBarContainer>
            <SeekbarCurrentTime>{formatSeconds(player.seekPosition)}</SeekbarCurrentTime>
            <SeekBar value={player.seekPosition}
                     onSlChange={handleSeekbarChange}
                     max={player?.audioLength ?? 0}
                     min={0}
                     step={1}
                     tooltipFormatter={formatSeconds}
            />
            <SeekbarRemainingTime>
              {formatSeconds((player?.audioLength ?? 0) - player.seekPosition)}
            </SeekbarRemainingTime>
          </SeekBarContainer>
        )}
      </>)}
    </SlDrawer>
  )
}
