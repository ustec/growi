import { body, param } from 'express-validator';

import { apiV3FormValidator } from '~/server/middlewares/apiv3-form-validator';
import loggerFactory from '~/utils/logger';

import BookmarkFolder from '../../models/bookmark-folder';

const logger = loggerFactory('growi:routes:apiv3:bookmark-folder');

const express = require('express');

const router = express.Router();

const validator = {
  bookmarkFolder: [
    body('name').isString().withMessage('name must be a string'),
    body('parent').optional({ nullable: true }),
  ],
};

module.exports = (crowi) => {
  const accessTokenParser = require('../../middlewares/access-token-parser')(crowi);
  const loginRequiredStrictly = require('../../middlewares/login-required')(crowi);

  // Create new bookmark folder
  router.post('/', accessTokenParser, loginRequiredStrictly, validator.bookmarkFolder, apiV3FormValidator, async(req, res) => {
    const owner = req.user?._id;
    const { name, parent } = req.body;
    const params = {
      name, owner, parent,
    };

    try {
      const bookmarkFolder = BookmarkFolder.createByParameters(params);
      logger.debug('bookmark folder created', bookmarkFolder);
      return res.apiv3({ bookmarkFolder });
    }
    catch (err) {
      logger.error('create bookmark folder failed', err);
      return res.apiv3Err(err, 500);
    }
  });

  // List all main bookmark folders
  router.get('/list', accessTokenParser, loginRequiredStrictly, async(req, res) => {
    try {
      const bookmarkFolders = await BookmarkFolder.findParentFolderByUserId(req.user?._id);
      return res.apiv3({ bookmarkFolders });
    }
    catch (err) {
      return res.apiv3Err(err, 500);
    }
  });

  router.get('/list-child/:parentId', accessTokenParser, loginRequiredStrictly, async(req, res) => {
    const { parentId } = req.params;
    try {
      const bookmarkFolders = await BookmarkFolder.findChildFolderById(parentId);
      return res.apiv3({ bookmarkFolders });
    }
    catch (err) {
      return res.apiv3Err(err, 500);
    }
  });

  // Delete bookmark folder and children
  router.delete('/', accessTokenParser, loginRequiredStrictly, async(req, res) => {
    const { boookmarkFolderId } = req.body;
    try {
      await BookmarkFolder.deleteFolderAndChildren(boookmarkFolderId);
      return res.apiv3();
    }
    catch (err) {
      logger.error(err);
      return res.apiv3Err(err, 500);
    }
  });

  router.put('/', accessTokenParser, loginRequiredStrictly, validator.bookmarkFolder, async(req, res) => {
    const { bookmarkFolderId, name, parent } = req.body;
    try {
      const bookmarkFolder = await BookmarkFolder.updateBookmarkFolder(bookmarkFolderId, name, parent);
      return res.apiv3({ bookmarkFolder });
    }
    catch (err) {
      return res.apiv3Err(err, 500);
    }
  });
  return router;
};
