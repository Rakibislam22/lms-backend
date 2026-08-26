'use strict';

/**
 * lesson-progress router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

const allow = (roles) => [{ name: 'global::has-role', config: { roles } }];
module.exports = createCoreRouter('api::lesson-progress.lesson-progress', {
  config: {
    find: { policies: allow(['admin', 'content_manager', 'instructor', 'student']) },
    findOne: { policies: allow(['admin', 'content_manager', 'instructor', 'student']) },
    create: { policies: allow(['student']) },
    update: { policies: allow(['student']) },
    delete: { policies: allow(['admin', 'student']) },
  },
});
