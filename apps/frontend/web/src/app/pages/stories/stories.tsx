import {SlDetails} from "@shoelace-style/shoelace/dist/react";
import {useCallback, useEffect, useMemo} from "react";
import {PlayButton} from "./components/play-button";
import {useStories} from "../../../state/stories.state";
import {useHistory, useLocation} from "react-router-dom";

export function Stories() {
  const {books, fetchBooks} = useStories();

  const location = useLocation();
  const history = useHistory();

  const {currentlyOpenBook, currentlyOpenStory} = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return {
      currentlyOpenBook: params.get("book"),
      currentlyOpenStory: params.get("episode"),
    }
  }, [location.search]);

  const setCurrentlyOpenBook = useCallback((bookSlug: string) => {
    console.log("setCurrentlyOpenBook", bookSlug);
    const currentSearch = new URLSearchParams(location.search);
    currentSearch.set("book", bookSlug);
    currentSearch.set("episode", '0');

    history.push({
      pathname: location.pathname,
      search: currentSearch.toString(),
    });
  }, [history, location.pathname, location.search]);

  const setCurrentlyOpenEpisode = useCallback((episode: number) => {
    console.log("setCurrentlyOpenEpisode", episode);
    const currentSearch = new URLSearchParams(location.search);
    currentSearch.set("episode", episode.toString());

    history.push({
      pathname: location.pathname,
      search: currentSearch.toString(),
    });
  }, [history, location.pathname, location.search]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchBooks();
    }, 30 * 60 * 1000);
    return () => {
      clearInterval(interval);
    };
  }, [fetchBooks])

  return (
    <div>
      {books.map((book) => (
        <SlDetails key={`book-${book.slug}`}
                   open={currentlyOpenBook === book.slug}
                   onSlShow={() => setCurrentlyOpenBook(book.slug)}
                   summary={book.title}
        >
          {
            book.stories.map(story => (
              <SlDetails key={`episode-${story.bookSlug}/${story.episode}`}
                         open={currentlyOpenStory === `${story.bookSlug}/${story.episode}`}
                         onSlShow={() => setCurrentlyOpenEpisode(story.episode)}
                         summary={`Episode ${story.episode}`}
              >
                {story.description}
                <PlayButton book={book} episode={story.episode}/>
              </SlDetails>
            ))
          }
        </SlDetails>
      ))}
    </div>
  )
}
