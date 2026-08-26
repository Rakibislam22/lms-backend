'use strict';

/**
 * quiz-result router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

const allow = (roles) => [{ name: 'global::has-role', config: { roles } }];
module.exports = createCoreRouter('api::quiz-result.quiz-result', {
  config: {
    find: { policies: allow(['admin', 'content_manager', 'instructor', 'student']) },
    findOne: { policies: allow(['admin', 'content_manager', 'instructor', 'student']) },
    create: { policies: allow(['student']) },
    update: { policies: allow(['admin']) },
    delete: { policies: allow(['admin', 'student']) },
  },
});
