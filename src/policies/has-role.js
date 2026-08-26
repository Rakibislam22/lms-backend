'use strict';

const { getRoleType } = require('../utils/access');

/**
 * Route policy used in addition to Strapi's permission matrix.  Keeping this
 * check on the server means a client cannot gain access by changing its UI.
 */
module.exports = async (ctx, config, { strapi }) => {
  const role = await getRoleType(strapi, ctx.state.user);
  if (!role && config.roles?.includes('public')) return true;
  return Boolean(role && config.roles?.includes(role));
};
