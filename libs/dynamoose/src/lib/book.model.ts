import {Book} from "@bobs-bedtime-stories/shared";
import {model, Schema} from "dynamoose";
import {Document} from "dynamoose/dist/Document";

export class BookDocument extends Document implements Book {
  title!: string;
  slug!: string;
  description!: string;
  coverImageUrl!: string;
}

export const BookTableName = 'books';

export const BookSchema = new Schema({
  title: {
    type: String,
    required: true,
  },
  slug: {
    type: Number,
    required: true,
    hashKey: true,
  },
  description: {
    type: String,
    required: true,
  },
  coverImageUrl: {
    type: String,
    required: true,
  },
});

export const BookModel = model<BookDocument>(BookTableName, BookSchema, {
  create: true,
  update: true,
});
