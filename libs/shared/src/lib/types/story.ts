export interface Story {
  bookSlug: string;
  episode: number;
  date: Date;
  audioS3Key: string;
  description?: string;
  imageUrls?: string[];
  videoUrls?: string[];
  externalLinks?: string[];
  startedListening?: boolean;
  finishedListening?: boolean;
}
