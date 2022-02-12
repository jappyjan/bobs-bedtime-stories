import {SlButton, SlDialog, SlInput} from "@shoelace-style/shoelace/dist/react";
import {ReactNode, useCallback, useEffect, useRef, useState} from "react";
import {callApi} from "../../../utils/api";

interface Props {
  children: ReactNode;
}

export function AuthWall(props: Props) {
  const [passCode, setPassCode] = useState(localStorage.getItem("pass-code") || "");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const input = useRef<null | HTMLInputElement>(null);

  const handleInitialFocus = useCallback((event) => {
    event.preventDefault();
    input.current?.focus();
  }, []);

  const verifyLogin = useCallback(async (silent?: boolean) => {
    try {
      await callApi('/auth/verify-passcode', 'POST', undefined, {'pass-code': passCode});
      localStorage.setItem('pass-code', passCode);
      setIsAuthenticated(true);
    } catch (e) {
      setIsAuthenticated(false);

      if (!silent) {
        alert("Ne, die waren es nicht... Versuch's nochmal!");
      }
    }
  }, [setIsAuthenticated, passCode, callApi]);

  useEffect(() => {
    verifyLogin(true);
  }, [verifyLogin])

  const handleInputChange = useCallback((event: Event) => {
    const target = event.target as HTMLInputElement;
    setPassCode(
      target.value
        .trim()
        .split('')
        .map((c) => Number(c))
        .filter((n) => !Number.isNaN(n))
        .map((n) => n.toString())
        .join('')
        .substring(0, 4),
    );
  }, []);

  if (isAuthenticated) {
    return <>{props.children}</>;
  }

  return (
    <SlDialog label="Sesam öffne dich oder so..." open={true} onSlInitialFocus={handleInitialFocus}>
      <SlInput ref={input}
               placeholder="Die vier magischen Zahlen bitte..."
               onSlChange={handleInputChange}
               value={passCode}
      />
      <SlButton slot="footer" variant="primary" onClick={() => verifyLogin()}>
        Anmelden
      </SlButton>
    </SlDialog>
  )
}
