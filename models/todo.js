'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Todo extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate({ User }) {
      // define association here
      this.belongsTo(User, { foreignKey: 'userId', as: 'user' })
    }

    toJSON() {
      return { ...this.get(), id: undefined, userId: undefined }
    }

  }
  Todo.init({
    uuid: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4
    },
    title: {
      type: DataTypes.STRING(70)
    },
    description: {
      type: DataTypes.STRING(70)
    },
    isCompleted: {
      type: DataTypes.BOOLEAN,
      default: false
    }
  }, {
    sequelize,
    tableName: 'todos',
    modelName: 'Todo'
  });
  return Todo;
};