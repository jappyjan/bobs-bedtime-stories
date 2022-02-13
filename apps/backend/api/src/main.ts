import 'source-map-support/register';
import {HttpApiRouter} from "@bobs-bedtime-stories/backend-api-rest";
import {getBooks} from "./handlers/books.get";
import {getStoriesOfBook} from "./handlers/stories.get";
import {verifyPasscode} from "./handlers/verify.passcode";
import {postBook} from "./handlers/books.post";
import {postANewEpisode} from "./handlers/stories.post";

const router = new HttpApiRouter();

router.addRoutes()
  .get('/books', getBooks)
  .post('/books', postBook)
  .get('/books/{bookSlug}/stories', getStoriesOfBook)
  .post('/books/{bookSlug}/stories', postANewEpisode)
  .post('/auth/verify-passcode', verifyPasscode);

export const handler = router.handler.bind(router);
export const routes = router.routes;
