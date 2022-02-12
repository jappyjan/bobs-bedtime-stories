import styled from "styled-components";
import {SlButton, SlIcon} from "@shoelace-style/shoelace/dist/react";
import {usePlayer} from "../../../../state/player.state";
import {BookWithStories} from "@bobs-bedtime-stories/shared";

const StyledButton = styled(SlButton)`
  display: block;
`;

interface Props {
  book: BookWithStories;
  episode: number;
}

export function PlayButton(props: Props) {
  const {book, episode} = props;

  const player = usePlayer();

  return (
    <StyledButton
      variant="default"
      size="large"
      circle
      onClick={() => player.play({
        book,
        episode
      })}
    >
      <SlIcon name="play"/>
    </StyledButton>
  )
}
