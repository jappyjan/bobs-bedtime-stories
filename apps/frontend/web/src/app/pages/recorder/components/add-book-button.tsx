import styled from "styled-components";
import {SlButton, SlDialog, SlIcon, SlInput, SlTextarea} from "@shoelace-style/shoelace/dist/react";
import {useCallback, useRef, useState} from "react";
import {callApi} from "../../../../utils/api";
import {useStories} from "../../../../state/stories.state";
import {BookWithStories} from "@bobs-bedtime-stories/shared";

const BookTitleInput = styled(SlInput)`
  margin-bottom: 1rem;
`;

interface Props {
  className?: string;
  onCreate?: (book: BookWithStories) => void;
}

export function AddBookButton(props: Props) {
  const {onCreate, ...domProps} = props;
  const input = useRef<null | HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [show, setShow] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const {addBook} = useStories();

  const handleInitialFocus = useCallback((event) => {
    event.preventDefault();
    input.current?.focus();
  }, []);

  const handleTitleChange = useCallback((event: Event) => {
    const target = event.target as HTMLInputElement;
    setTitle(target.value.trim());
  }, []);

  const handleDescriptionChange = useCallback((event: Event) => {
    const target = event.target as HTMLInputElement;
    setDescription(target.value.trim());
  }, []);

  const createBook = useCallback(async () => {
    try {
      setIsCreating(true);
      const book = await addBook({title, description});
      setShow(false);
      if (onCreate) {
        onCreate(book);
      }
    } catch (e) {
      alert((e as Error).message);
      console.error(e);
    } finally {
      setIsCreating(false);
    }
  }, [callApi, title, description]);

  return (<>
    <SlButton variant="primary"
              size="medium"
              circle
              onClick={() => setShow(true)}
              {...domProps}
    >
      <SlIcon name="plus"/>
    </SlButton>
    <SlDialog label="Neues Buch?" open={show} onSlInitialFocus={handleInitialFocus}
              onSlAfterHide={() => setShow(false)}>
      <BookTitleInput ref={input}
                      onSlChange={handleTitleChange}
                      value={title}
                      label="Gib mir einen Namen..."
      />
      <SlTextarea label="Beschreib mich..."
                  value={description}
                  onSlChange={handleDescriptionChange}
      />
      <SlButton slot="footer"
                variant="primary"
                onClick={() => createBook()}
                loading={isCreating}
      >
        Erstellen 🐑
      </SlButton>
    </SlDialog>
  </>)
}
