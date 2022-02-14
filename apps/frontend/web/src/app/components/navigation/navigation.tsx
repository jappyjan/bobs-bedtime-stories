import {SlIconButton} from "@shoelace-style/shoelace/dist/react";
import styled from "styled-components";
import {NavigationItem, NavigationLinkItem} from "./NavigationLinkItem";
import {HTMLAttributes} from "react";
import {usePlayer} from "../../../state/player.state";

const StyledNavigation = styled.nav`
  height: 3rem;
  width: 100%;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  margin-bottom: 1rem;
`;

type Props = HTMLAttributes<HTMLElement>;

export function Navigation(props: Props) {
  const player = usePlayer();

  return (
    <StyledNavigation {...props}>
      <NavigationLinkItem iconName={'book'} to={'/'} label={'Stories'}/>
      <NavigationItem>
        <SlIconButton name="music-player"
                      label="Now Playing"
                      onClick={() => player.setPlayerVisibility(!player.showPlayer)}
        />
      </NavigationItem>
      <NavigationLinkItem iconName={'record-circle'} to={'/record'} label={'Record'}/>
    </StyledNavigation>
  )
}
