import {useCallback, useState} from "react";
import {SlMenuItem, SlSelect, SlSpinner} from "@shoelace-style/shoelace/dist/react";
import {useStories} from "../../../state/stories.state";
import styled from "styled-components";
import {AddBookButton} from "./components/add-book-button";
import {AudioRecorder} from "./components/audio-recorder";
import {useHistory} from "react-router-dom";
import {FileUpload} from "./components/file-upload";

const RootContainer = styled.div`
  display: grid;
  grid-template-rows: min-content auto;
`;

const BookSelectorContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  width: 100%;
  grid-row: 1;
`;

const BookSelector = styled(SlSelect)`
  flex-grow: 1;
`;

const StyledAddBookButton = styled(AddBookButton)`
  flex-shrink: 1;
  margin-left: 0.5rem;
`;

const MainContainer = styled.div`
  grid-row: 2;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
`;

const StyledUploadSpinnerContainer = styled.div`
  grid-row: 2;
  display: flex;
  justify-content: center;
  align-items: center;
`;

export function Recorder() {
  const {books, addStory} = useStories();
  const history = useHistory();

  const [selectedBookSlug, setSelectedBookSlug] = useState<string>('');
  const [isCreatingStory, setIsCreatingStory] = useState<boolean>(false);

  const createStory = useCallback(async (audioFile: Blob) => {
    try {
      setIsCreatingStory(true);
      const story = await addStory({
        bookSlug: selectedBookSlug,
        audioFile,
      });
      history.push(`/?book=${selectedBookSlug}&episode=${story.episode}`);
    } catch (e) {
      alert((e as Error).message);
      console.error(e);
    } finally {
      setIsCreatingStory(false);
    }
  }, [selectedBookSlug, addStory, history, setIsCreatingStory]);

  const onBookSelectionChange = useCallback((event: Event) => {
    const selection = (event.target as HTMLInputElement).value;
    setSelectedBookSlug(selection)
  }, [setSelectedBookSlug]);

  if (isCreatingStory) {
    return (
      <RootContainer>
        <StyledUploadSpinnerContainer>
          <SlSpinner style={{fontSize: '6rem'} as any}/>
        </StyledUploadSpinnerContainer>
      </RootContainer>
    )
  }

  const bookSelector = (
    <BookSelectorContainer>
      <BookSelector label="Welches Buch liest du?"
                    value={selectedBookSlug}
                    onSlChange={onBookSelectionChange}
      >
        {books.map((book) => (
          <SlMenuItem key={book.slug} value={book.slug}>
            {book.title}
          </SlMenuItem>
        ))}
      </BookSelector>
      <StyledAddBookButton onCreate={(createdBook) => setSelectedBookSlug(createdBook.slug)}/>
    </BookSelectorContainer>
  );

  return (
    <RootContainer>
      {bookSelector}

      {selectedBookSlug && (
        <MainContainer>
          <AudioRecorder onDone={createStory}/>
          <FileUpload onFileUpload={createStory}/>
        </MainContainer>
      )}
    </RootContainer>
  )
}
