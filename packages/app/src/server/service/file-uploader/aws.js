import loggerFactory from '~/utils/logger';

const logger = loggerFactory('growi:service:fileUploaderAws');

const urljoin = require('url-join');
const aws = require('aws-sdk');

module.exports = function(crowi) {
  const Uploader = require('./uploader');
  const { configManager } = crowi;
  const lib = new Uploader(crowi);

  function getAwsConfig() {
    return {
      accessKeyId: configManager.getConfig('crowi', 'aws:s3AccessKeyId'),
      secretAccessKey: configManager.getConfig('crowi', 'aws:s3SecretAccessKey'),
      region: configManager.getConfig('crowi', 'aws:s3Region'),
      bucket: configManager.getConfig('crowi', 'aws:s3Bucket'),
      customEndpoint: configManager.getConfig('crowi', 'aws:s3CustomEndpoint'),
    };
  }

  function S3Factory() {
    const awsConfig = getAwsConfig();

    aws.config.update({
      accessKeyId: awsConfig.accessKeyId,
      secretAccessKey: awsConfig.secretAccessKey,
      region: awsConfig.region,
      s3ForcePathStyle: awsConfig.customEndpoint ? true : undefined,
    });

    // undefined & null & '' => default endpoint (genuine S3)
    return new aws.S3({ endpoint: awsConfig.customEndpoint || undefined });
  }

  function getFilePathOnStorage(attachment) {
    if (attachment.filePath != null) { // backward compatibility for v3.3.x or below
      return attachment.filePath;
    }

    const dirName = (attachment.page != null)
      ? 'attachment'
      : 'user';
    const filePath = urljoin(dirName, attachment.fileName);

    return filePath;
  }

  async function isFileExists(s3, params) {
    // check file exists
    try {
      await s3.headObject(params).promise();
    }
    catch (err) {
      if (err != null && err.code === 'NotFound') {
        return false;
      }

      // error except for 'NotFound
      throw err;
    }

    return true;
  }

  lib.isValidUploadSettings = function() {
    return this.configManager.getConfig('crowi', 'aws:s3AccessKeyId') != null
      && this.configManager.getConfig('crowi', 'aws:s3SecretAccessKey') != null
      && (
        this.configManager.getConfig('crowi', 'aws:s3Region') != null
          || this.configManager.getConfig('crowi', 'aws:s3CustomEndpoint') != null
      )
      && this.configManager.getConfig('crowi', 'aws:s3Bucket') != null;
  };

  lib.canRespond = function() {
    return !this.configManager.getConfig('crowi', 'aws:referenceFileWithRelayMode');
  };

  lib.respond = async function(res, attachment) {
    if (!this.getIsUploadable()) {
      throw new Error('AWS is not configured.');
    }
    const temporaryUrl = attachment.getValidTemporaryUrl();
    if (temporaryUrl != null) {
      return res.redirect(temporaryUrl);
    }

    const s3 = S3Factory();
    const awsConfig = getAwsConfig();
    const filePath = getFilePathOnStorage(attachment);
    const lifetimeSecForTemporaryUrl = this.configManager.getConfig('crowi', 'aws:lifetimeSecForTemporaryUrl');

    // issue signed url (default: expires 120 seconds)
    // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#getSignedUrl-property
    const params = {
      Bucket: awsConfig.bucket,
      Key: filePath,
      Expires: lifetimeSecForTemporaryUrl,
    };
    const signedUrl = s3.getSignedUrl('getObject', params);

    res.redirect(signedUrl);

    try {
      return attachment.cashTemporaryUrlByProvideSec(signedUrl, lifetimeSecForTemporaryUrl);
    }
    catch (err) {
      logger.error(err);
    }

  };

  lib.deleteFile = async function(attachment) {
    const filePath = getFilePathOnStorage(attachment);
    return lib.deleteFileByFilePath(filePath);
  };

  lib.deleteFiles = async function(attachments) {
    if (!this.getIsUploadable()) {
      throw new Error('AWS is not configured.');
    }
    const s3 = S3Factory();
    const awsConfig = getAwsConfig();

    const filePaths = attachments.map((attachment) => {
      return { Key: getFilePathOnStorage(attachment) };
    });

    const totalParams = {
      Bucket: awsConfig.bucket,
      Delete: { Objects: filePaths },
    };
    return s3.deleteObjects(totalParams).promise();
  };

  lib.deleteFileByFilePath = async function(filePath) {
    if (!this.getIsUploadable()) {
      throw new Error('AWS is not configured.');
    }
    const s3 = S3Factory();
    const awsConfig = getAwsConfig();

    const params = {
      Bucket: awsConfig.bucket,
      Key: filePath,
    };

    // check file exists
    const isExists = await isFileExists(s3, params);
    if (!isExists) {
      logger.warn(`Any object that relate to the Attachment (${filePath}) does not exist in AWS S3`);
      return;
    }

    return s3.deleteObject(params).promise();
  };

  lib.uploadFile = function(fileStream, attachment) {
    if (!this.getIsUploadable()) {
      throw new Error('AWS is not configured.');
    }

    logger.debug(`File uploading: fileName=${attachment.fileName}`);

    const s3 = S3Factory();
    const awsConfig = getAwsConfig();

    const filePath = getFilePathOnStorage(attachment);
    const params = {
      Bucket: awsConfig.bucket,
      ContentType: attachment.fileFormat,
      Key: filePath,
      Body: fileStream,
      ACL: 'public-read',
    };

    return s3.upload(params).promise();
  };

  /**
   * Find data substance
   *
   * @param {Attachment} attachment
   * @return {stream.Readable} readable stream
   */
  lib.findDeliveryFile = async function(attachment) {
    if (!this.getIsReadable()) {
      throw new Error('AWS is not configured.');
    }

    const s3 = S3Factory();
    const awsConfig = getAwsConfig();
    const filePath = getFilePathOnStorage(attachment);

    const params = {
      Bucket: awsConfig.bucket,
      Key: filePath,
    };

    // check file exists
    const isExists = await isFileExists(s3, params);
    if (!isExists) {
      throw new Error(`Any object that relate to the Attachment (${filePath}) does not exist in AWS S3`);
    }

    let stream;
    try {
      stream = s3.getObject(params).createReadStream();
    }
    catch (err) {
      logger.error(err);
      throw new Error(`Coudn't get file from AWS for the Attachment (${attachment._id.toString()})`);
    }

    // return stream.Readable
    return stream;
  };

  /**
   * check the file size limit
   *
   * In detail, the followings are checked.
   * - per-file size limit (specified by MAX_FILE_SIZE)
   */
  lib.checkLimit = async(uploadFileSize) => {
    const maxFileSize = crowi.configManager.getConfig('crowi', 'app:maxFileSize');
    const totalLimit = crowi.configManager.getConfig('crowi', 'app:fileUploadTotalLimit');
    return lib.doCheckLimit(uploadFileSize, maxFileSize, totalLimit);
  };


  // method for INVESTIGATION
  lib.INVxCreateMultiPartUpload = async function(callback) {
    if (!this.isValidUploadSettings()) {
      throw new Error('AWS S3 is not configured.');
    }

    const s3 = S3Factory();
    const awsConfig = getAwsConfig();

    const params = {
      Bucket: awsConfig.bucket,
      Key: 'bulk-export-test',
      ContentType: 'application/zip',
    };

    try {
      // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#createMultipartUpload-property
      // TODO: set ACL to "authenticated-read"?
      s3.createMultipartUpload(params, callback);
    }
    catch (err) {
      logger.error('Error occurred while createMultipartUpload:', err);
      throw err;
    }
  };

  // mui: MultipartUploadInfo
  // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#uploadPart-property
  lib.INVxUploadPartMultipartUpload = async function(mui, stream, callback) {
    if (!this.isValidUploadSettings()) {
      throw new Error('AWS S3 is not configured.');
    }

    const s3 = S3Factory();
    const awsConfig = getAwsConfig();

    const { key, uploadId, uploadedParts } = mui;


    // increment partNumber
    const partNumber = Array.from(uploadedParts.keys()).length + 1;
    console.log('なにこれ', Array.from(uploadedParts.keys()), partNumber);

    const contentLength = stream.pointer();

    const params = {
      Bucket: awsConfig.bucket,
      Key: key,
      Body: stream,
      PartNumber: partNumber,
      UploadId: uploadId,
      ContentLength: contentLength,
    };

    try {
      s3.uploadPart(params, callback);
    }
    catch (err) {
      logger.error('Failed to uploadPart:', err);
      throw err;
    }
  };

  lib.INVxCompleteMultipartUpload = async function(mui, callback) {
    if (!this.isValidUploadSettings()) {
      throw new Error('AWS S3 is not configured.');
    }

    const s3 = S3Factory();
    const awsConfig = getAwsConfig();

    const { key, uploadId, uploadedParts } = mui;

    const parts = [];

    uploadedParts.keys().forEach((key) => {
      parts.push({
        ETag: uploadedParts.get(key),
        PartNumber: key,
      });
    });

    // set at least one part using uploadedParts
    const params = {
      Bucket: awsConfig.bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts,
      },
    };

    // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#completeMultipartUpload-property
    s3.completeMultipartUpload(params, callback);
  };

  return lib;
};
