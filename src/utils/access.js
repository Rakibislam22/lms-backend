'use strict';

const getRoleType = async (strapi, user) => {
  if (!user) return null;
  if (user.role?.type) return user.role.type;

  const currentUser = await strapi.db
    .query('plugin::users-permissions.user')
    .findOne({ where: { id: user.id }, populate: ['role'] });

  if (currentUser?.role) user.role = currentUser.role;
  return currentUser?.role?.type ?? null;
};

const isAdmin = async (strapi, user) => (await getRoleType(strapi, user)) === 'admin';
const isContentManager = async (strapi, user) => (await getRoleType(strapi, user)) === 'content_manager';
const isInstructor = async (strapi, user) => (await getRoleType(strapi, user)) === 'instructor';
const isStudent = async (strapi, user) => (await getRoleType(strapi, user)) === 'student';
const isContentManagerOrAdmin = async (strapi, user) => {
  const role = await getRoleType(strapi, user);
  return role === 'admin' || role === 'content_manager';
};

module.exports = {
  getRoleType,
  isAdmin,
  isContentManager,
  isInstructor,
  isStudent,
  isContentManagerOrAdmin,
};
