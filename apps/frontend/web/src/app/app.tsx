import styled from 'styled-components';
import {Route} from "react-router-dom";
import {Navigation} from "./components/navigation/navigation";
import {Stories} from './pages/stories/stories';
import {Recorder} from "./pages/recorder/recorder";
import {Player} from "./components/player/player";
import {usePlayer} from "../state/player.state";
import {useEffect} from "react";
import {AuthWall} from "./components/auth-wall/auth-wall";

const StyledApp = styled.div`
  min-height: 100vh;
  min-width: 100vw;
  display: grid;
  grid-template-rows: auto 3rem;
  grid-template-columns: auto;
`;

const StyledMainContent = styled.div`
  grid-row: 1;
  overflow: auto;
  padding: .75rem;
`

export function App() {
  const player = usePlayer();

  useEffect(() => {
    player.init();
  }, []);

  return (
    <StyledApp>
      <StyledApp>
        <Navigation style={{gridRow: 2}}/>
        <StyledMainContent>
          <AuthWall>
            <Route path='/' exact component={Stories}/>
            <Route path='/record' exact component={Recorder}/>
            <Player/>
          </AuthWall>
        </StyledMainContent>
      </StyledApp>
    </StyledApp>
  );
}

export default App;