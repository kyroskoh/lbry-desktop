// @flow
import * as React from 'react';
import moment from 'moment';
import { normalizeURI, convertToShareLink } from 'lbry-redux';
import type { Claim, Metadata } from 'types/claim';
import Button from 'component/button';
import CardMedia from 'component/cardMedia';
import TruncatedText from 'component/common/truncated-text';
import Icon from 'component/common/icon';
import UriIndicator from 'component/uriIndicator';
import * as icons from 'constants/icons';
import classnames from 'classnames';
import { openCopyLinkMenu } from '../../util/contextMenu';

type Props = {
  uri: string,
  claim: Claim,
  lastViewed: number,
  clearHistoryUri: string => void,
  navigate: string => void,
};

class HistoryItem extends React.PureComponent<Props> {
  render() {
    const { uri, claim, lastViewed, navigate, clearHistoryUri } = this.props;

    return (
      <p>
        <Button button="link" href={uri} label={claim.value.stream.metadata.title} />{' '}
        {moment(lastViewed).from(moment())}{' '}
        <Icon icon={icons.CLOSE} iconColor="red" onClick={() => clearHistoryUri(uri)} />
      </p>
    );
  }
}

export default HistoryItem;
