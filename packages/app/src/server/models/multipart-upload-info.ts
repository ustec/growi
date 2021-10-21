import {
  Schema, Model, Document,
} from 'mongoose';
import { getOrCreateModel } from '@growi/core';

type PartNumber = number;
type ETag = string;

export type Part = Map<PartNumber, ETag>;

export interface IMultipartUploadInfo {
  key: string
  uploadId: string
  uploadedParts: Part[]
  createdAt: Date
}

export interface MultipartUploadInfoDocument extends IMultipartUploadInfo, Document {}

// export interface MultipartUploadInfoModel extends Model<MultipartUploadInfoDocument> {}
export type MultipartUploadInfoModel = Model<MultipartUploadInfoDocument>

const MultipartUploadInfoSchema = new Schema<MultipartUploadInfoDocument, MultipartUploadInfoModel>({
  key: { type: String, required: true },
  uploadId: { type: String, required: true },
  uploadedParts: { type: Map, default: [] },
  createdAt: { type: Date, default: Date.now },
});

export default getOrCreateModel<MultipartUploadInfoDocument, MultipartUploadInfoModel>('MultipartUploadInfo', MultipartUploadInfoSchema);
