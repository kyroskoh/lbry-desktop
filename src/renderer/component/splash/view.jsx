import * as React from 'react';
import { Lbry, MODALS } from 'lbry-redux';
import LoadScreen from './internal/load-screen';
import ModalWalletUnlock from 'modal/modalWalletUnlock';
import ModalIncompatibleDaemon from 'modal/modalIncompatibleDaemon';
import ModalUpgrade from 'modal/modalUpgrade';
import ModalDownloading from 'modal/modalDownloading';

type Props = {
  checkDaemonVersion: () => Promise<any>,
  notifyUnlockWallet: () => Promise<any>,
  notification: ?{
    id: string,
  },
};

type State = {
  details: string,
  message: string,
  isRunning: boolean,
  isLagging: boolean,
  launchedModal: boolean,
};

export class SplashScreen extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      details: __('Starting daemon'),
      message: __('Connecting'),
      isRunning: false,
      isLagging: false,
      launchedModal: false,
    };
  }

  updateStatus() {
    Lbry.status().then(status => {
      this._updateStatusCallback(status);
    });
  }

  _updateStatusCallback(status) {
    const { notifyUnlockWallet } = this.props;
    const { launchedModal } = this.state;

    //
    // if (!status.wallet.is_unlocked) {
    //   this.setState({
    //     message: __('Unlock Wallet'),
    //     details: __('Please unlock your wallet to proceed.'),
    //     isLagging: false,
    //     isRunning: true,
    //   });
    //
    //   if (launchedModal === false) {
    //     this.setState({ launchedModal: true }, () => notifyUnlockWallet());
    //   }
    //   return;
    // }

    if (status.is_running) {
      // Wait until we are able to resolve a name before declaring
      // that we are done.
      // TODO: This is a hack, and the logic should live in the daemon
      // to give us a better sense of when we are actually started
      this.setState({
        isRunning: true,
      });

      Lbry.resolve({ uri: 'lbry://one' }).then(() => {
        // Only leave the load screen if the daemon version matched;
        // otherwise we'll notify the user at the end of the load screen.

        if (this.props.daemonVersionMatched) {
          this.props.onReadyToLaunch();
        }
      });
      return;
    }

    console.log('status: ', status);
    if (status.blockchain_headers && status.blockchain_headers.download_progress < 100) {
      this.setState({
        message: __('Downloading Headers'),
        details: `${status.blockchain_headers.download_progress}% ${__('complete')}`,
      });
    } else if (status.wallet && status.wallet.blocks_behind > 0) {
      const format = status.wallet.blocks_behind == 1 ? '%s block behind' : '%s blocks behind';
      this.setState({
        message: __('Blockchain Sync'),
        details: __(format, status.wallet.blocks_behind),
      });
    } else {
      this.setState({
        message: __('Starting Up'),
        details: '',
      });
    }
    setTimeout(() => {
      this.updateStatus();
    }, 500);
  }

  componentDidMount() {
    const { checkDaemonVersion } = this.props;

    Lbry.connect()
      .then(checkDaemonVersion)
      .then(() => {
        this.updateStatus();
      })
      .catch(() => {
        this.setState({
          isLagging: true,
          message: __('Connection Failure'),
          details: __(
            'Try closing all LBRY processes and starting again. If this still happens, your anti-virus software or firewall may be preventing LBRY from connecting. Contact hello@lbry.io if you think this is a software bug.'
          ),
        });
      });
  }

  render() {
    const { notification } = this.props;
    const { message, details, isLagging, isRunning } = this.state;

    const notificationId = notification && notification.id;

    return (
      <React.Fragment>
        <LoadScreen message={message} details={details} isWarning={isLagging} />
        {/* Temp hack: don't show any modals on splash screen daemon is running;
            daemon doesn't let you quit during startup, so the "Quit" buttons
            in the modals won't work. */}
        {isRunning && (
          <React.Fragment>
            {notificationId === MODALS.WALLET_UNLOCK && <ModalWalletUnlock />}
            {notificationId === MODALS.INCOMPATIBLE_DAEMON && <ModalIncompatibleDaemon />}
            {notificationId === MODALS.UPGRADE && <ModalUpgrade />}
            {notificationId === MODALS.DOWNLOADING && <ModalDownloading />}
          </React.Fragment>
        )}
      </React.Fragment>
    );
  }
}

export default SplashScreen;
