import {Link} from "react-router-dom";
import {SlIconButton} from "@shoelace-style/shoelace/dist/react";
import styled from "styled-components";

interface Props {
  iconName: string;
  to: string;
  label: string;
}

export const StyledIconButton = styled(SlIconButton)`
  &.active {
    color: var(--sl-color-primary-50)
  }
`;

export const NavigationItem = styled.div`
  width: 100%;
  text-align: center;
  font-size: 2rem;
`;

export function NavigationLinkItem(props: Props) {
  const {iconName, to, label} = props;
  return (
    <Link to={to}>
      <NavigationItem>
        <StyledIconButton name={iconName} label={label}/>
      </NavigationItem>
    </Link>
  );
}
