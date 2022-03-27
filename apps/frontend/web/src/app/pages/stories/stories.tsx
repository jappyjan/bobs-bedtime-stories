import {SlDetails} from "@shoelace-style/shoelace/dist/react";
import {useCallback, useEffect, useState} from "react";
import {PlayButton} from "./components/play-button";
import {useStories} from "../../../state/stories.state";
import {useHistory, useLocation} from "react-router-dom";
import {Story} from "@bobs-bedtime-stories/shared";

export function Stories() {
  const {books, fetchBooks} = useStories();

  const location = useLocation();
  const history = useHistory();

  const [currentlyOpen, setCurrentlyOpenInternal] = useState<Pick<Story, 'bookSlug' | 'episode'> | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const book = params.get("book");
    const episode = params.get("episode");

    setCurrentlyOpenInternal((book && episode) ? {
      bookSlug: book,
      episode: Number(episode),
    } : null);
  }, [location.search]);

  const setCurrentlyOpenBook = useCallback((bookSlug: string) => {
    const currentSearch = new URLSearchParams(location.search);
    if (currentSearch.get("book") === bookSlug) {
      return;
    }

    currentSearch.set("book", bookSlug);
    currentSearch.set("episode", '0');

    history.push({
      pathname: location.pathname,
      search: currentSearch.toString(),
    });
    setCurrentlyOpenInternal({
      bookSlug,
      episode: 0,
    });
  }, [history, location.pathname, location.search]);

  const setCurrentlyOpenEpisode = useCallback((episode: number) => {
    const currentSearch = new URLSearchParams(location.search);
    currentSearch.set("episode", episode.toString());

    console.log(currentSearch.toString());

    history.push({
      pathname: location.pathname,
      search: currentSearch.toString(),
    });
    setCurrentlyOpenInternal((current) => {
      return {
        bookSlug: current?.bookSlug ?? '',
        episode,
      }
    });
  }, [history, location.pathname, location.search]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchBooks();
    }, 30 * 60 * 1000);
    return () => {
      clearInterval(interval);
    };
  }, [fetchBooks]);

  const getStoryPlayStateEmoji = useCallback((story: Pick<Story, 'startedListening' | 'finishedListening'>) => {
    if (story.finishedListening) {
      return '🍘'
    }

    if (story.startedListening) {
      return '🍚'
    }

    return '🥠'
  }, []);

  return (
    <div>
      {books.map((book) => (
        <div key={`book-${book.slug}`}
             style={{marginBottom: '1rem'}}
        >
          <SlDetails open={currentlyOpen?.bookSlug === book.slug}
                     onSlShow={() => setCurrentlyOpenBook(book.slug)}
                     summary={book.title}
          >
            <p style={{
              whiteSpace: 'pre-line',
              marginBottom: '1rem'
            }}>{book.description ?? '...leider ohne Beschreibung...'}</p>
            {
              book.stories.map(story => (
                <div key={`episode-${story.bookSlug}/${story.episode}`}
                     style={{marginBottom: '1rem'}}
                >
                  <SlDetails
                    open={currentlyOpen?.bookSlug === story.bookSlug && currentlyOpen?.episode === story.episode}
                    onSlShow={() => setCurrentlyOpenEpisode(story.episode)}
                    summary={`${getStoryPlayStateEmoji(story)} Episode ${story.episode}`}
                  >
                    {story.description && (
                      <p style={{
                        whiteSpace: 'pre-line',
                        marginBottom: '2rem'
                      }}>{story.description ?? '...leider ohne Beschreibung...'}</p>
                    )}
                    <PlayButton book={book} episode={story.episode}/>
                  </SlDetails>
                </div>
              ))
            }
          </SlDetails>
        </div>
      ))}
    </div>
  )
}
