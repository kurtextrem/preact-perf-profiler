import test from 'ava';
import { createGlobals, resetGlobals, getId, createPerfApi } from './_helpers';
import { h, render, Component, options } from 'preact';
import sinon from 'sinon';
import fromComponent from '../src/component';

test.before(() => options.debounceRendering = fn => fn());

test.after(() => delete options.debounceRendering);

test.beforeEach(createGlobals);

test.afterEach(resetGlobals);

test('bare class, single render', t => {
  const performance = createPerfApi();

  class A extends Component {
    render({ myProp }) {
      return <p>{myProp}</p>;
    }
  }

  const B = fromComponent(A, undefined, { performance });
  const rendered = render(<B myProp="Yay!" />, document.body);

  t.true(Component.isPrototypeOf(B), 'Wrapped component is a Preact component');

  t.is(rendered.nodeName, 'P');
  t.is(rendered.childNodes[0].nodeValue, 'Yay!', 'passes through rendered JSX');

  t.is(
    performance.mark.callCount,
    2,
    'should have created start and end marks'
  );
  t.is(performance.measure.callCount, 1, 'should have created one measure');

  const startMark = performance.mark.getCall(0).args[0];
  const endMark = performance.mark.getCall(1).args[0];

  t.deepEqual(
    performance.measure.getCall(0).args,
    ['A', startMark, endMark],
    'should have correct measure name and marks'
  );
});

test('bare class, re-render', t => {
  const performance = createPerfApi();

  class A extends Component {
    render({ myProp }) {
      return <p>{myProp}</p>;
    }
  }

  const B = fromComponent(A, undefined, { performance });
  let rendered = render(<B myProp="Yay!" />, document.body);
  rendered = render(<B myProp="Woop!" />, document.body, rendered);

  t.is(rendered.childNodes[0].nodeValue, 'Woop!', 'should have rerendered');

  t.is(performance.mark.callCount, 4, 'should have made 4 marks');
  t.is(performance.measure.callCount, 2, 'should have made 2 measures');

  const firstId = getId(performance.mark.getCall(0).args[0]);
  const secondId = getId(performance.mark.getCall(2).args[0]);

  t.not(
    firstId,
    secondId,
    'ids should not match for two different measurements'
  );

  t.is(performance.measure.callCount, 2, 'should have created two measures');

  t.is(
    performance.measure.getCall(0).args[0],
    performance.measure.getCall(1).args[0],
    'measures should be the same between renders'
  );
});

test('lifecycle methods called correctly', t => {
  const performance = createPerfApi();

  const mocks = {
    willMount: sinon.spy(),
    didMount: sinon.spy(),
    willReceiveProps: sinon.spy(),
    didUpdate: sinon.spy()
  };

  class A extends Component {
    constructor(props) {
      super(props);
      this.state = { s: 'state ' };
    }
    componentWillMount() { mocks.willMount(); }
    componentDidMount() { mocks.didMount(); }
    componentWillReceiveProps(nextProps) {
      mocks.willReceiveProps(nextProps);
    }
    componentDidUpdate() { mocks.didUpdate(); }
    render() { return <div>Yes.</div>; }
  }

  const B = fromComponent(A, undefined, { performance });

  const rendered = render(<B />, document.body);

  t.is(mocks.willMount.callCount, 1, 'willMount has been called');
  t.is(mocks.didMount.callCount, 1, 'didMount has been called');
  t.is(mocks.willReceiveProps.callCount, 0, 'should not have called willReceiveProps');
  t.is(mocks.didUpdate.callCount, 0, 'should not have called didUpdate');

  render(<B p="props" />, document.body, rendered);

  t.is(mocks.willMount.callCount, 1, 'should not have called willMount again');
  t.is(mocks.didMount.callCount, 1, 'should not have called didMount again');
  t.is(mocks.willReceiveProps.callCount, 1, 'should have called willReceiveProps');
  t.deepEqual(
    mocks.willReceiveProps.getCall(0).args,
    [{ children: [], p: 'props' }],
    'willReceiveProps gets nextProps'
  );
  t.is(mocks.didUpdate.callCount, 1, 'should have called didUpdate');
});

test('use props and state for measure name in initial and subsequent render', t => {
  const performance = createPerfApi();

  class A extends Component {
    constructor(props) {
      super(props);
      this.state = { count: 0 };
    }
    incrementCount() {
      this.setState({ count: this.state.count + 1 });
    }
    render() {
      return <div>Hello</div>;
    }
  }

  const B = fromComponent(
    A,
    ({ name }, { count }) => `A(name=${name},count=${count})`,
    { performance }
  );

  const rendered = render(<B name="Harry" />, document.body);
  render(<B name="Sally" />, document.body, rendered);

  const instance = rendered._component;
  instance.incrementCount();

  t.is(performance.measure.callCount, 3);
  t.is(performance.measure.getCall(0).args[0], 'A(name=Harry,count=0)');
  t.is(performance.measure.getCall(1).args[0], 'A(name=Sally,count=0)');
  t.is(performance.measure.getCall(2).args[0], 'A(name=Sally,count=1)');
});
