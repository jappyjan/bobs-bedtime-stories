import createState from 'zustand';
import {Workbox} from "workbox-window";

interface ServiceWorkerState {
  isWaiting: boolean;
  workbox: Workbox | null;
  init: () => void;
  updateApp: () => void;
}

export const useServiceWorker = createState<ServiceWorkerState>((set, get) => ({
  isWaiting: false,
  workbox: null,
  init: () => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    window.addEventListener("load", () => {
      const workbox = new Workbox("/sw.js");

      workbox.register();

      workbox.addEventListener("waiting", () => {
        set({isWaiting: true});
      });

      set({workbox});
    });
  },
  updateApp: () => {
    const {isWaiting, workbox} = get();

    if (!isWaiting || !workbox) {
      return;
    }

    workbox.addEventListener("controlling", () => {
      window.location.reload();
    });

    // Send a message telling the service worker to skip waiting.
    // This will trigger the `controlling` event handler above.
    workbox.messageSW({type: "SKIP_WAITING"});
  },
}));
