// @flow
import * as React from 'react';
import classnames from 'classnames';

type Props = {
  children: React.Node,
  pageTitle: ?string,
  noPadding: ?boolean,
  extraPadding: ?boolean,
  notContained: ?boolean, // No max-width, but keep the padding
  loading: ?boolean,
};

const LOADER_DELAY = 500;

class Page extends React.PureComponent<Props, State> {
  constructor() {
    super();
    this.state = {
      showLoader: false,
    }
    console.log("construct")
    this.loaderTimeout = null;
  }

  componentDidMount() {
    this.loaderTimeout = setTimeout(() => {
      this.setState({ showLoader: true })
    }, LOADER_DELAY)
  }

  componentDidUpdate(oldProps: Props) {
    const { loading: wasLoading } = oldProps;
    const { loading } = this.props;
    if (this.loaderTimeout && wasLoading && !loading) {
      this.loaderTimeout = null;
      this.setState({ showLoader: false });
    }
  }

  componentWillUnmount() {
    this.loaderTimeout = null;
  }

  render() {
    const { pageTitle, children, noPadding, extraPadding, notContained, loading } = this.props;
    const { showLoader } = this.state;
    console.log('showLoader', showLoader);
    return (
      <main
        className={classnames('main', {
          'main--contained': !notContained && !noPadding && !extraPadding,
          'main--no-padding': noPadding,
          'main--extra-padding': extraPadding,
        })}
      >
        {pageTitle && (
          <div className="page__header">
            {pageTitle && <h1 className="page__title">{pageTitle}</h1>}
          </div>
        )}
        {(loading || !children) && showLoader && <div>Loading</div>}
        {!loading &&  children}
      </main>
    );
  }
}

export default Page;
