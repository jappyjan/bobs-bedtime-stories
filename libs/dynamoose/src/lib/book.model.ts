import {Book} from "@bobs-bedtime-stories/shared";
import {model, Schema} from "dynamoose";
import {Document} from "dynamoose/dist/Document";

export class BookDocument extends Document implements Book {
  title!: string;
  slug!: string;
  description!: string;
  coverImageUrl!: string;
}

export const BookTableName = process.env.DYNAMO_TABLE_books;

export const BookSchema = new Schema({
  title: {
    type: String,
    required: true,
  },
  slug: {
    type: String,
    required: true,
    hashKey: true,
  },
  description: {
    type: String,
    required: true,
  },
  coverImageUrl: {
    type: String,
    required: false,
  },
});

export const makeBookModel = () => model<BookDocument>(BookTableName, BookSchema, {
  create: false,
  update: false,
});
