import React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';

import { Panel, Checkbox } from 'react-bootstrap';

import RequestControlForm from '../components/RemoteAccess/RequestControlForm';
import UserList from '../components/RemoteAccess/UserList';

import { sendAllowRemote, sendTimeoutGivesControl } from '../actions/remoteAccess';

export class RemoteAccessContainer extends React.Component {
  getRAOptions() {
    let content = (<div className="col-xs-4">
                     <Panel>
                       <Panel.Heading>
                         RA Options
                       </Panel.Heading>
                       <Panel.Body>
                         <Checkbox
                           onClick={(e) => this.props.sendAllowRemote(e.target.checked)}
                           defaultChecked={this.props.remoteAccess.allowRemote}
                           checked={this.props.remoteAccess.allowRemote}
                         >
                           Enable remote access
                         </Checkbox>
                         <Checkbox
                           onClick={(e) => this.props.sendTimeoutGivesControl(e.target.checked)}
                           defaultChecked={this.props.remoteAccess.timeoutGivesControl}
                           checked={this.props.remoteAccess.timeoutGivesControl}
                         >
                           Timeout gives control
                         </Checkbox>
                       </Panel.Body>
                     </Panel>
                   </div>);

    if (!this.props.login.user.isstaff) {
      content = null;
    }

    return content;
  }

  render() {
    return (
      <div className="col-xs-12">
        { !this.props.login.user.inControl ?
          (<div className="col-xs-4">
            <RequestControlForm />
           </div>) : null
        }
        <div className="col-xs-4">
          <UserList />
        </div>
        {this.getRAOptions()}
      </div>
    );
  }
}


function mapStateToProps(state) {
  return {
    remoteAccess: state.remoteAccess,
    login: state.login
  };
}

function mapDispatchToProps(dispatch) {
  return {
    sendAllowRemote: bindActionCreators(sendAllowRemote, dispatch),
    sendTimeoutGivesControl: bindActionCreators(sendTimeoutGivesControl, dispatch)
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(RemoteAccessContainer);
