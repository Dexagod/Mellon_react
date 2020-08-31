import React from 'react'
import solid from 'solid-auth-client'
import { Snackbar, Button } from '@material-ui/core'
import { Alert } from '@material-ui/lab'
import DeleteIcon from '@material-ui/icons/Delete'

import CommunicationManager from 'util/CommunicationManager';
import AccessControlTable from './AccessControlTable'
import { MODES, createPermission } from '../util/PermissionManager'

import "../styles/AccessController.css"

const newTableRow = {
	read: false,
	write: false,
	comment: false,
	control: false
}

export class AccessController extends React.Component {

	constructor(props) {
		super(props);

		this.cm = props.cm || new CommunicationManager(solid);
		let documentURI = Object.keys(props.selection)[0];
		this.succes = false;

		this.state = {
			userHasControl: false,
			documentURI,
			permissions: [],
			commentPermissions: [],
			tableData: [],
			showAlert: false,
		};
	}

	// fetch data after creation
	async componentDidMount() {
		this.fetchData(this.state.documentURI)
	}

	async componentDidUpdate(prevProps) {
		// Re-fetch if other document was selected
		let documentURI = Object.keys(this.props.selection)[0];
		if (Object.keys(prevProps.selection)[0] !== documentURI) {
			this.fetchData(documentURI)
		}
	}

	async fetchData(documentURI) {
		let permissions = [], commentPermissions = [];
		try {
			permissions = await this.cm.pm.getPermissions(documentURI);
			commentPermissions = await this.cm.pm.getPermissions(this.cm.getMetadataURI(documentURI));
		} catch {
			// User has no Control
			this.setState({
				userHasControl: false,
				permissions, commentPermissions,
				tableData: []
			});
		}
		let tableData = this.createTableData(permissions, commentPermissions);

		// Check if user has control
		let userHasControl = false;
		let userCanWrite = false;
		let webID = await this.cm.getCurrentWebID();
		for (let row of tableData) {
			if (row.agent === webID || row.agent === null) {
				if (row.control) { userHasControl = true; }
				if (row.write) { userCanWrite = true; }
			}
		}
		this.setState(state => {
			return {
				userHasControl,
				userCanWrite,
				documentURI,
				permissions, commentPermissions,
				tableData
			}
		});
	}

	/* A 'null' value means everybody */
  	createTableData(permissions, commentPermissions) {
		let tableData = [{ ...newTableRow, agent: null}];
		let agentIndexes = { null: 0 }; // First is for null a.k.a. 'everybody'
		function processPermission(permission) {
			if (permission.agents === null) {
				permission.agents = [null];
			}
			for (let agent of permission.agents) {
				let index = agentIndexes[agent];
				if (index === undefined) {
					index = tableData.length;
					agentIndexes[agent] = index
					// Set because you can have a permission only once
					tableData.push({
						...newTableRow,
						agent
					});
				}
				for (let mode of permission.modes) {
					tableData[index][mode.toLowerCase()] = true;
				}
			}
		}
    	for (let permission of permissions) {
			processPermission(permission)
		}
		// comment permissions
		for (let permission of commentPermissions) {
			if (permission.modes.includes(MODES.APPEND) || permission.modes.includes(MODES.WRITE)) {
				permission.modes = [MODES.COMMENT];
				processPermission(permission);
			}
		}
    	return tableData;
	}

	// TODO: check valid webId's, groups, weird permissions (only write, owner no control, ...)
	submitValues() {
		try {
			this.changePermissions();
			this.succes = true;
		} catch {
			this.succes = false;
		}
		this.setState({ showAlert: true });
	}

	changePermissions() {
		let permissions = [];
		let readAgents = [];
		let controlAgents = [];
		// Comment is APPEND permission on metafile.
		let commentPermissions = [];

		function addPermission(permissions, agent, modes) {
			if (!modes.length) { return permissions; }
			modes.sort()
			// Always add new if the mode is for everyone
			if (agent === null) {
				permissions.push({ agents: null, modes: modes});
				return permissions;
			}
			for (let permission of permissions) {
				// Assumes permission.modes is sorted
				if (permission.modes.join('') === modes.join('') && permission.agents !== null) {
					permission.agents.push(agent);
					return permissions;
				}
			}
			// Mode does not yet exist
			permissions.push({ agents: [agent], modes: modes });
			return permissions;
		}

		for (let row of this.state.tableData) {  // 'row' is like { agent: 'bob', read: true, write: false ... }
			if (row.comment) {
				commentPermissions = addPermission(commentPermissions, row.agent, [MODES.APPEND]);  // comment is APPEND on metadata file
			}
			let modes = [];
			for (let [mode, access] of [[MODES.READ, row.read], [MODES.WRITE, row.write], [MODES.CONTROL, row.control]]) {
				if (access) { modes.push(mode); }
			}
			permissions = addPermission(permissions, row.agent, modes);
			// All Readers
			if (row.read) {
				if (row.agent === null) {
					readAgents = null;
				} else if (readAgents !== null) {
					readAgents.push(row.agent)
				}
			}
			// All Controllers
			if (row.control) {
				if (row.agent === null) {
					controlAgents = null;
				} else if (controlAgents !== null) {
					controlAgents.push(row.agent)
				}
			}
		}

		this.cm.pm.reCreateACL(this.state.documentURI, permissions);
		// All readers of the paper should also be able to read the metafile and parent folder
		commentPermissions.push(createPermission([MODES.READ], readAgents))
		commentPermissions.push(createPermission([MODES.CONTROL, MODES.WRITE], controlAgents)) // Write permission to delete file
		this.cm.pm.reCreateACL(this.cm.getMetadataURI(this.state.documentURI), commentPermissions);

		// 'addToACL' seems not to handle 'null' for every agent, so use reCreate in that case
		let folderName = this.state.documentURI.split('/').slice(0, -1).join('/') + '/'
		if (readAgents === null) {
			this.cm.pm.reCreateACL(folderName, [createPermission([MODES.READ], readAgents)]);
			this.cm.pm.addToACL(folderName, [createPermission([MODES.CONTROL], controlAgents)]);
		} else if (controlAgents === null) {
			this.cm.pm.reCreateACL(folderName, [createPermission([MODES.CONTROL], controlAgents)]);
			this.cm.pm.addToACL(folderName, [createPermission([MODES.READ], readAgents)]);
		} else {
			this.cm.pm.addToACL(folderName, [
				createPermission([MODES.READ], readAgents),
				createPermission([MODES.CONTROL], controlAgents)
			]);
		}
	}

	deletePaper() {
		this.cm.deletePaper(Object.values(this.props.selection)[0]);
		this.props.fileRemoved();
	}

	render() {
		if (!this.state.userHasControl) { return null; }
		const { tableData } = this.state;
		// Contacs that don't have permission should also be displayed
		let allAgents = new Set();
		for (let row of tableData) {
			allAgents.add(row.agent);
		}
		for (let contact of this.props.contacts) {
			if (!allAgents.has(contact.id)) {
				allAgents.add(contact.id);
				tableData.push({
					...newTableRow,
					agent: contact.id
				});
			}
		}

		const closeAlert = (event, reason) => {
			if (reason === 'clickaway') { return; }
			this.setState({ showAlert: false }, () => this.succes = false);
		};
		return (
			<div className="accesscontroller">
				{/* TODO: confirmation? */}
				{this.state.userCanWrite ? <Button className="button-delete-file" title="Delete this file" variant="outlined" size="small" onClick={() => this.deletePaper()}><DeleteIcon /></Button> : null}
				<p>Permissions for this file</p>
				<AccessControlTable tableData={this.state.tableData}
					submitValues={data => this.setState({ tableData: data }, this.submitValues)} />
				<Snackbar open={this.state.showAlert} autoHideDuration={3000} onClose={closeAlert}>
					<Alert variant="filled" onClose={closeAlert} severity={this.succes ? "success" : "warning"} >
					{this.succes ? "Permissions changed succesfully!" : "Something went wrong"}
					</Alert>
				</Snackbar>
			</div>
		);
	}
}