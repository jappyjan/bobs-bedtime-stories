import {SlDetails} from "@shoelace-style/shoelace/dist/react";
import {useEffect, useState} from "react";
import {PlayButton} from "./components/play-button";
import {useStories} from "../../../state/stories.state";

export function Stories() {
  const {fetchBooks, books} = useStories();
  const [currentlyOpenBook, setCurrentlyOpenBook] = useState('');
  const [currentlyOpenStory, setCurrentlyOpenStory] = useState('');

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  return (
    <div>
      {books.map((book) => (
        <SlDetails key={book.slug}
                   open={currentlyOpenBook === book.slug}
                   onSlShow={() => setCurrentlyOpenBook(book.slug)}
                   summary={book.slug}
        >
          {
            book.stories.map(story => (
              <SlDetails key={`${book.slug}/${story.episode}`}
                         open={currentlyOpenStory === `${book.slug}/${story.episode}`}
                         onSlShow={() => setCurrentlyOpenStory(`${book.slug}/${story.episode}`)}
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
