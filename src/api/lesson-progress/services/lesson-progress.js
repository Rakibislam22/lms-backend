'use strict';

/**
 * lesson-progress service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::lesson-progress.lesson-progress');
