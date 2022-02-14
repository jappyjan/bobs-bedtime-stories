import {SlButton} from "@shoelace-style/shoelace/dist/react";
import {HTMLAttributes, useCallback} from "react";

interface Props {
  onFileUpload: (file: File) => void;
}

export function FileUpload(props: Props & HTMLAttributes<HTMLButtonElement>) {
  const {onFileUpload, ...domProps} = props;

  const handleFileInput = useCallback(() => {
      const input = document.createElement('input') as HTMLInputElement;
      input.type = 'file';
      input.accept = 'audio/*';
      input.onchange = () => {
        const file = (input.files as FileList).item(0);
        if (file) {
          onFileUpload(file);
        }
        document.body.removeChild(input);
      };
      document.body.appendChild(input);
      input.click();
    }, [onFileUpload],
  );

  return (
    <SlButton onClick={handleFileInput} variant={'text'} {...domProps as any}>
      Ich will was hochladen...
    </SlButton>
  );
}
