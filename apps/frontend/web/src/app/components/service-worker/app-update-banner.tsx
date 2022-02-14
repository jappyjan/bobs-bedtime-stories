import {useServiceWorker} from "../../../state/service-worker.state";
import {SlButton, SlDivider, SlDrawer} from "@shoelace-style/shoelace/dist/react";
import {useCallback, useEffect, useState} from "react";

export function AppUpdateBanner() {
  const serviceWorker = useServiceWorker();

  const [show, setShow] = useState(serviceWorker.isWaiting);

  useEffect(() => {
    setShow(serviceWorker.isWaiting);
  }, [serviceWorker.isWaiting, setShow]);

  const close = useCallback(() => {
    setShow(false);
    setTimeout(() => {
      setShow(serviceWorker.isWaiting);
    }, 10 * 60 * 1000);
  }, [serviceWorker.isWaiting, setShow]);

  const updateApp = useCallback(() => {
    serviceWorker.updateApp();
  }, [serviceWorker.updateApp]);

  return (
    <SlDrawer placement="bottom"
              open={show}
              label="Ein Update ist verfügbar"
              onSlAfterHide={() => close()}
    >
      <h2>willst du es jetzt installieren?</h2>
      <small>(Dauert nur wenige Sekunden)</small>
      <SlDivider/>
      <SlButton onClick={() => updateApp()}>Jetzt aktualisieren!</SlButton>
    </SlDrawer>
  )
}
