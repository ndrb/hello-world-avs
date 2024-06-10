import React, { Component } from 'react'
import Web3 from 'web3'
import './App.css'
import { ethers } from 'ethers';
import { delegationABI } from "./abis/delegationABI.ts";
import { contractABI } from './abis/contractABI.ts';
import { registryABI } from './abis/registryABI.ts';
import { avsDirectoryABI } from './abis/avsDirectoryABI.ts';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableCell, { tableCellClasses } from '@mui/material/TableCell';
import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';


const provider = new ethers.providers.JsonRpcProvider(process.env.REACT_APP_RPC_URL);
const wallet = new ethers.Wallet(process.env.REACT_APP_PRIVATE_KEY, provider);
const signingKey = new ethers.utils.SigningKey(process.env.REACT_APP_PRIVATE_KEY);

const delegationManagerAddress = process.env.REACT_APP_DELEGATION_MANAGER_ADDRESS;
const contractAddress = process.env.REACT_APP_CONTRACT_ADDRESS;
const stakeRegistryAddress = process.env.REACT_APP_STAKE_REGISTRY_ADDRESS;
const avsDirectoryAddress = process.env.REACT_APP_AVS_DIRECTORY_ADDRESS;

const delegationManager = new ethers.Contract(delegationManagerAddress, delegationABI, wallet);
const contract = new ethers.Contract(contractAddress, contractABI, wallet);
const registryContract = new ethers.Contract(stakeRegistryAddress, registryABI, wallet);
const avsDirectory = new ethers.Contract(avsDirectoryAddress, avsDirectoryABI, wallet);


const StyledTableCell = styled(TableCell)(({ theme }) => ({
  [`&.${tableCellClasses.head}`]: {
    backgroundColor: "#353494",
    color: theme.palette.common.white,
  },
  [`&.${tableCellClasses.body}`]: {
    fontSize: 14,
  },
}));
const ELPaper = styled(Paper)(({ theme }) => ({
  width: '28em',
  height: '6em',
  padding: theme.spacing(1),
  ...theme.typography.body2,
  textAlign: 'center',
  alignContent: 'center',
  backgroundColor: '#CADFFF',
  paddingTop: '.75rem',
  paddingBottom: '.75rem',
  margin: '.75em',
}));
const ELHeighAdjustedPaper= styled(Paper)(({ theme }) => ({
  height: '8em',
  padding: theme.spacing(1),
  ...theme.typography.body2,
  textAlign: 'center',
  alignContent: 'center',
  backgroundColor: '#CADFFF',
  paddingTop: '.75rem',
  paddingBottom: '.75rem',
  margin: '.75em',
}));
const ELButton = styled(Button)(({ theme }) => ({
  padding: theme.spacing(1),
  ...theme.typography.body2,
  textAlign: 'center',
  alignContent: 'center',
  backgroundColor: '#271C7C',
  paddingTop: '.75rem',
  paddingBottom: '.75rem',
  margin: '.75em',
}));
const Item = styled(Paper)(({ theme }) => ({
  ...theme.typography.body2,
  padding: theme.spacing(1),
  fontSize:"16px",
  textAlign: 'center',
  alignContent: 'center',
  backgroundColor: '#CADFFF',
  paddingTop: '.75rem',
  paddingBottom: '.75rem',
  margin: '.75em',
}));
const StaticItem = styled(Paper)(({ theme }) => ({
  backgroundColor: '#353494',
  elevation: 24,
  padding: theme.spacing(1),
  textAlign: 'center',
  alignContent: 'center',
  paddingTop: '.75rem',
  paddingBottom: '.75rem',
  margin: '.75em',
  color: '#ffffff',
}));
const PaddedPaper = styled(Paper)(({ theme }) => ({
  marginTop: '2em',
  marginBottom: '2em',
}));
const StyledTableRow = styled(TableRow)(({ theme }) => ({
  '&:nth-of-type(odd)': {
    backgroundColor: '#CADFFF',
  },
  // hide last border
  '&:last-child td, &:last-child th': {
    border: 0,
  },
}));

const sessionStorageBaseName = "HELLO_WORLD_AVS_LOCAL_"

class App extends Component {

  async signAndRespondToTask(taskIndex, taskCreatedBlock, taskName) {
    const message = `Hello, ${taskName}`;
    const messageHash = ethers.utils.solidityKeccak256(["string"], [message]);
    const messageBytes = ethers.utils.arrayify(messageHash);
    const signature = await wallet.signMessage(messageBytes);
  
    console.log(
        `Signing and responding to task ${taskIndex}`
    )
  
    const tx = await contract.respondToTask(
        { name: taskName, taskCreatedBlock: taskCreatedBlock },
        taskIndex,
        signature
    );
    await tx.wait();
    console.log(`Responded to task.`);
    var tasksMap = this.state.tasksMap;
    var taskNameValue = tasksMap.get(taskName);
    tasksMap.set(taskName, {taskCreatedBlock: taskNameValue['taskCreatedBlock'], taskIndex: taskNameValue['taskIndex'], signed: true, receipt: taskNameValue['receipt']});
    this.setState({ tasksMap: tasksMap});  
    var mapToArr = Array.from(tasksMap.entries());
    window.sessionStorage.setItem(sessionStorageBaseName+"tasksMap", JSON.stringify(mapToArr));
  }
  
  async registerOperator() {
    const tx1 = await delegationManager.registerAsOperator({
        earningsReceiver: await wallet.address,
        delegationApprover: "0x0000000000000000000000000000000000000000",
        stakerOptOutWindowBlocks: 0
    }, "");
    await tx1.wait();
    console.log("Operator registered on EL successfully");
    this.setState({ operatorRegisteredOnEL: true});
    window.sessionStorage.setItem(sessionStorageBaseName+"operatorRegisteredOnEL", true);
  
  
    const salt = ethers.utils.hexlify(ethers.utils.randomBytes(32));
    const expiry = Math.floor(Date.now() / 1000) + 3600; // Example expiry, 1 hour from now
  
    // Define the output structure
    let operatorSignature = {
        expiry: expiry,
        salt: salt,
        signature: ""
    };
  
    // Calculate the digest hash using the avsDirectory's method
    const digestHash = await avsDirectory.calculateOperatorAVSRegistrationDigestHash(
        wallet.address, 
        contract.address, 
        salt, 
        expiry
    );
  
    // Sign the digest hash with the operator's private key
    const signature = signingKey.signDigest(digestHash);
    
    // Encode the signature in the required format
    operatorSignature.signature = ethers.utils.joinSignature(signature);
  
    const tx2 = await registryContract.registerOperatorWithSignature(
        wallet.address,
        operatorSignature
    );
    await tx2.wait();
    console.log("Operator registered on AVS successfully");
    this.setState({ operatorRegisteredOnAVS: true});
    window.sessionStorage.setItem(sessionStorageBaseName+"operatorRegisteredOnAVS", true);
  }
  
  async monitorNewTasks(){  
    this.setState({ monitoringTasks: true});
    window.sessionStorage.setItem(sessionStorageBaseName+"monitoringTasks", true);
    contract.on("NewTaskCreated", async (taskIndex, task) => {
        console.log(`New task detected: ${task.name}`);
        var tasksMap = this.state.tasksMap;
        var taskNameValue = tasksMap.get(task.name);
        var receipt;
        if(taskNameValue != null)
          receipt = taskNameValue['receipt']
        tasksMap.set(task.name, {taskCreatedBlock: task.taskCreatedBlock, taskIndex: taskIndex, signed: false, receipt: receipt});
        this.setState({ tasksMap: tasksMap});  
        var mapToArr = Array.from(tasksMap.entries());
        window.sessionStorage.setItem(sessionStorageBaseName+"tasksMap", JSON.stringify(mapToArr));
        await this.signAndRespondToTask(taskIndex, task.taskCreatedBlock, task.name);
        this.setState({ latestBlockTask: task.taskCreatedBlock});  
        window.sessionStorage.setItem(sessionStorageBaseName+"latestBlockTask", task.taskCreatedBlock);
    });
    console.log("Monitoring for new tasks...");
  }
  
  async createNewTask() {
    try {
      var taskName = this.state.textInput;
      // Send a transaction to the createNewTask function
      const tx = await contract.createNewTask(taskName);
      
      // Wait for the transaction to be mined
      const receipt = await tx.wait();
      
      console.log(`Transaction successful with hash: ${receipt.transactionHash}`);


      var tasksMap = this.state.tasksMap;
      tasksMap.set(taskName, {receipt: receipt.transactionHash});
      this.setState({ tasksMap: tasksMap});

      var mapToArr = Array.from(tasksMap.entries());
      window.sessionStorage.setItem(sessionStorageBaseName+"tasksMap", JSON.stringify(mapToArr));
    } catch (error) {
      console.error('Error sending transaction:', error);
    }
  }

  componentDidMount() {
    this.loadBlockchainData();
  }

  async loadBlockchainData() {
    const web3 = new Web3(process.env.REACT_APP_RPC_URL)
    const accounts = await web3.eth.getAccounts();
    const walletAddress = wallet.address;

    var latestTaskNum = 0;
    var allTaskHashes = "N/A";
    var allTaskResponses = "N/A";
    
    try {
      latestTaskNum = await contract.latestTaskNum();
      allTaskHashes = await contract.allTaskHashes(latestTaskNum);
      allTaskResponses = await contract.allTaskResponses(walletAddress, latestTaskNum-1);
    } catch (error) {
      if(error.toString().includes("value out-of-bounds"))
        allTaskHashes = "N/A"
      else
        allTaskHashes = error.toString() + "ERROR";
    }

    //To convert string value to boolean
    var operatorRegisteredOnELSaved = window.sessionStorage.getItem(sessionStorageBaseName+"operatorRegisteredOnEL") === "true";

    var operatorRegisteredOnAVSSaved = window.sessionStorage.getItem(sessionStorageBaseName+"operatorRegisteredOnAVS") === "true";

    var monitoringTasks = false;

    var tasksMap = JSON.parse(window.sessionStorage.getItem(sessionStorageBaseName+"tasksMap"));
    if (tasksMap == null)
    {
      tasksMap = new Map();
    }
    else
    {
      tasksMap = new Map((tasksMap));
    }

    var latestBlockTaskSaved = window.sessionStorage.getItem(sessionStorageBaseName+"latestBlockTask");
    if(latestBlockTaskSaved == null)
    {
      latestBlockTaskSaved = 0;
    }

    this.setState({ 
      account: accounts[0], 
      tasksMap: tasksMap,
      latestTaskNum: latestTaskNum, 
      allTaskHashes: allTaskHashes,
      allTaskResponses: allTaskResponses,
      operatorRegisteredOnEL: operatorRegisteredOnELSaved,
      operatorRegisteredOnAVS: operatorRegisteredOnAVSSaved,
      monitoringTasks: monitoringTasks,
      latestBlockTask: latestBlockTaskSaved,
    })
  }

  handleChange(e) {
    this.setState({ textInput: e.target.value });
  }

  constructor(props) {
    super(props)
    this.createNewTask = this.createNewTask.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.registerOperator = this.registerOperator.bind(this);
    var tasksMap = new Map();
    this.state = { 
      account: '', 
      tasksMap: tasksMap,
      textInput: '', 
      operatorRegisteredOnEL: false,
      operatorRegisteredOnAVS: false,
      monitoringTasks: false,
      latestBlockTask: 0,
     }
  }

  render() {
    return (
      <div id="backdrop" >
        <div className="container">
          <Grid container spacing={2}>
          <Grid item xs={12} md={12}>
              <StaticItem><h3>Hello World AVS <b id="gradientColor">with React Frontend</b></h3></StaticItem>
            </Grid>
            <Grid item xs={6} md={8}>
              <Item>Latest Task Hash: {this.state.allTaskHashes}</Item>
            </Grid>
            <Grid item xs={6} md={4}>
              <Item>Latest Task Hash: {this.state.latestBlockTask}</Item>
            </Grid>
            <Grid item xs={6} md={6}>
              <Item>Your account: {this.state.account}</Item>
            </Grid>
            <Grid item xs={6} md={6}>
              <Item>Latest Task Number: {this.state.latestTaskNum}</Item>
            </Grid>
            <Grid item xs={6} md={12}>
              <Item>Latest Task Response: {this.state.allTaskResponses}</Item>
            </Grid>
          </Grid>

          <Grid container spacing={2}>
          <Grid item xs={12} md={12}>
              <StaticItem><h5>Task Creation</h5></StaticItem>
            </Grid>
            <Grid item xs={4} md={4}>
              <ELHeighAdjustedPaper>
                <Box>
                  <TextField
                    label="Task Name"
                    variant="filled"
                    InputLabelProps={{
                      shrink: true,
                    }}
                    helperText={'Your task name will be:'+this.state.textInput}
                    onChange={ this.handleChange }>
                  </TextField>
                </Box>
              </ELHeighAdjustedPaper>
            </Grid>
            <Grid item xs={4} md={4}>
              <ELHeighAdjustedPaper>
                <Box>
                  <ELButton 
                  variant="contained" 
                  onClick={()=>this.createNewTask()}
                  disabled={(!this.state.monitoringTasks) || (this.state.textInput === "")}
                  >Create Task</ELButton>
                </Box>
              </ELHeighAdjustedPaper>
            </Grid>
            <Grid item xs={4} md={4}>
            <ELHeighAdjustedPaper>
                <Box>
                  <ELButton 
                  variant="contained" 
                  onClick={()=>this.monitorNewTasks()} 
                  disabled={(!this.state.operatorRegisteredOnEL && !this.state.operatorRegisteredOnAVS) || (this.state.monitoringTasks)}
                  >Monitor Tasks</ELButton>
                </Box>
              </ELHeighAdjustedPaper>
            </Grid>
          </Grid>
          <TableContainer component={PaddedPaper}>
            <Table aria-label="customized table">
              <TableHead>
                <TableRow>
                  <StyledTableCell>Task Name</StyledTableCell>
                  <StyledTableCell align="right">Task Created Block&nbsp;</StyledTableCell>
                  <StyledTableCell align="right">Task Index&nbsp;</StyledTableCell>
                  <StyledTableCell align="right">Is Signed&nbsp;</StyledTableCell>
                  <StyledTableCell align="right">Tx Receipt</StyledTableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Array.from(this.state.tasksMap).map(([task, values], index) => (
                  <StyledTableRow key={index}>
                    <StyledTableCell component="th" scope="row">
                    {task}
                    </StyledTableCell>
                    <StyledTableCell align="right">{values.taskCreatedBlock}</StyledTableCell>
                    <StyledTableCell align="right">{values.taskIndex} </StyledTableCell>
                    <StyledTableCell align="right">{values.signed!==undefined && values.signed+""}</StyledTableCell>
                    <StyledTableCell align="right">{values.receipt} </StyledTableCell>
                  </StyledTableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Grid container spacing={2}>
          <Grid item xs={12} md={12}>
              <StaticItem><h5>Operator Registration</h5></StaticItem>
            </Grid>
            <Grid item xs={4} md={4}>
              <ELPaper>Operator Registered On EigenLayer: {this.state.operatorRegisteredOnEL + ""} </ELPaper>
            </Grid>
            <Grid item xs={4} md={4}>
              <ELPaper>Operator Registered On AVS: {this.state.operatorRegisteredOnAVS + ""}</ELPaper>
            </Grid>
            <Grid item xs={4} md={4}>
              <ELPaper>            
                <ELButton 
                  disabled={this.state.operatorRegisteredOnEL && this.state.operatorRegisteredOnAVS} 
                  onClick={()=>this.registerOperator()} variant="contained">Register Operator
                </ELButton>
              </ELPaper>
            </Grid>
          </Grid>
        </div>
      </div>
    );
  }
}

export default App;