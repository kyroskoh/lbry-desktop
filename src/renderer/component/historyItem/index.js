import { connect } from 'react-redux';
import { makeSelectClaimForUri } from 'lbry-redux';
import { doNavigate } from 'redux/actions/navigation';
import { doClearContentHistoryUri } from 'redux/actions/content';
import HistoryItem from './view';

const select = (state, props) => ({
  claim: makeSelectClaimForUri(props.uri)(state),
});

const perform = dispatch => ({
  navigate: (path, params) => dispatch(doNavigate(path, params)),
  clearHistoryUri: uri => dispatch(doClearContentHistoryUri(uri)),
});

export default connect(
  select,
  perform
)(HistoryItem);
