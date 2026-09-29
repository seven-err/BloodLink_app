const locatorModule = require('@locator/babel-jsx');

const createLocatorPlugin = locatorModule.default ?? locatorModule;

const normalizePath = (value) => value?.replaceAll('\\', '/');

module.exports = function locatorWebPlugin(babel) {
  const { types: t } = babel;
  const locatorPlugin = createLocatorPlugin(babel);
  const programVisitor = locatorPlugin.visitor.Program;

  const normalizeStatePaths = (state) => ({
    ...state,
    cwd: normalizePath(state.cwd),
    filename: normalizePath(state.filename),
  });

  const moveLocatorAttributeIntoDataSet = (openingElement) => {
    const attributes = openingElement.get('attributes');
    const locatorAttribute = attributes.find(
      (attribute) =>
        attribute.isJSXAttribute() &&
        attribute.node.name.name === 'data-locatorjs-id',
    );

    if (!locatorAttribute) {
      return;
    }

    const locatorValue = locatorAttribute.node.value;
    const valueExpression = t.isJSXExpressionContainer(locatorValue)
      ? locatorValue.expression
      : locatorValue;
    const locatorProperty = t.objectProperty(
      t.identifier('locatorjsId'),
      valueExpression,
    );
    const dataSetAttribute = attributes.find(
      (attribute) =>
        attribute.isJSXAttribute() && attribute.node.name.name === 'dataSet',
    );

    if (dataSetAttribute) {
      const dataSetValue = dataSetAttribute.node.value;
      if (
        t.isJSXExpressionContainer(dataSetValue) &&
        t.isObjectExpression(dataSetValue.expression)
      ) {
        dataSetValue.expression.properties.push(locatorProperty);
      } else if (
        t.isJSXExpressionContainer(dataSetValue) &&
        !t.isJSXEmptyExpression(dataSetValue.expression)
      ) {
        dataSetAttribute.node.value = t.jSXExpressionContainer(
          t.objectExpression([
            t.spreadElement(dataSetValue.expression),
            locatorProperty,
          ]),
        );
      }
    } else {
      openingElement.pushContainer(
        'attributes',
        t.jSXAttribute(
          t.jSXIdentifier('dataSet'),
          t.jSXExpressionContainer(t.objectExpression([locatorProperty])),
        ),
      );
    }

    locatorAttribute.remove();
  };

  const enterProgram = function enterProgram(path, state) {
    programVisitor.enter.call(this, path, normalizeStatePaths(state));

    path.traverse({
      JSXOpeningElement(openingElement) {
        moveLocatorAttributeIntoDataSet(openingElement);
      },
    });
  };

  const exitProgram = function exitProgram(path, state) {
    return programVisitor.exit.call(
      this,
      path,
      normalizeStatePaths(state),
    );
  };

  return {
    ...locatorPlugin,
    visitor: {
      ...locatorPlugin.visitor,
      Program: {
        ...programVisitor,
        enter: enterProgram,
        exit: exitProgram,
      },
    },
  };
};
