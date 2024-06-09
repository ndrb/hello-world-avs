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

const sessionStorageBaseName = "HELLO_WORLD_AVS_LOCAL_";
const StyledTableCell = styled(TableCell)(({ theme }) => ({
  [`&.${tableCellClasses.head}`]: {
    backgroundColor: theme.palette.common.black,
    color: theme.palette.common.white,
  },
  [`&.${tableCellClasses.body}`]: {
    fontSize: 14,
  },
}));

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  '&:nth-of-type(odd)': {
    backgroundColor: theme.palette.action.hover,
  },
  // hide last border
  '&:last-child td, &:last-child th': {
    border: 0,
  },
}));


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
    contract.on("NewTaskCreated", async (taskIndex, task) => {
        console.log(`New task detected: ${task.name}`);
        var tasksMap = this.state.tasksMap;
        var taskNameValue = tasksMap.get(task.name);
        console.log("PEEP:",taskNameValue);
        tasksMap.set(task.name, {taskCreatedBlock: task.taskCreatedBlock, taskIndex: taskIndex, signed: false, receipt: taskNameValue['receipt']});
        this.setState({ tasksMap: tasksMap});  
        var mapToArr = Array.from(tasksMap.entries());
        window.sessionStorage.setItem(sessionStorageBaseName+"tasksMap", JSON.stringify(mapToArr));
        await this.signAndRespondToTask(taskIndex, task.taskCreatedBlock, task.name);
    });
  
    console.log("Monitoring for new tasks...");
  }
  
  async mainFunction() {
    await this.registerOperator();
    this.monitorNewTasks().catch((error) => {
        console.error("Error monitoring tasks:", error);
    });
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

      var myTasks = this.state.tasksArray;
      myTasks.push(taskName);
      this.setState({ tasksArray: myTasks });

      window.sessionStorage.setItem(sessionStorageBaseName+"tasksArray", JSON.stringify(this.state.tasksArray));
      var mapToArr = Array.from(tasksMap.entries());
      window.sessionStorage.setItem(sessionStorageBaseName+"tasksMap", JSON.stringify(mapToArr));
    } catch (error) {
      console.error('Error sending transaction:', error);
    }
  }

  componentWillMount() {
    this.loadBlockchainData();
    this.monitorNewTasks();
  }

  async loadBlockchainData() {
    const web3 = new Web3(process.env.REACT_APP_RPC_URL)
    const accounts = await web3.eth.getAccounts();
    const walletAddress = wallet.address;

    var latestTaskNum = -1;
    var allTaskHashes = -2;
    var allTaskResponses = -3;
    
    try {
      latestTaskNum = await contract.latestTaskNum();
      allTaskHashes = await contract.allTaskHashes(latestTaskNum-1);
      allTaskResponses = await contract.allTaskResponses(walletAddress, latestTaskNum-1);
    } catch (error) {
      allTaskHashes = error.toString() + "ERROR";
    }

    var operatorRegisteredOnELSaved = window.sessionStorage.getItem(sessionStorageBaseName+"operatorRegisteredOnEL");
    if ( operatorRegisteredOnELSaved == null ) 
    {
      operatorRegisteredOnELSaved = false;
    }

    var operatorRegisteredOnAVSSaved = window.sessionStorage.getItem(sessionStorageBaseName+"operatorRegisteredOnAVS");
    if ( operatorRegisteredOnAVSSaved == null ) 
    {
      operatorRegisteredOnAVSSaved = false;
    }

    var tasksList = JSON.parse(window.sessionStorage.getItem(sessionStorageBaseName+"tasksArray"));
    if (tasksList == null)
    {
      tasksList = [];
    }

    var tasksMap = JSON.parse(window.sessionStorage.getItem(sessionStorageBaseName+"tasksMap"));
    if (tasksMap == null)
    {
      tasksMap = new Map();
    }
    else
    {
      console.log("LOL:",tasksMap)
      tasksMap = new Map((tasksMap));
    }

    this.setState({ 
      account: accounts[0], 
      tasksMap: tasksMap,
      tasksArray: tasksList,
      tasksLength: tasksList.length, 
      latestTaskNum: latestTaskNum, 
      allTaskHashes: allTaskHashes,
      allTaskResponses: allTaskResponses,
      operatorRegisteredOnEL: operatorRegisteredOnELSaved,
      operatorRegisteredOnAVS: operatorRegisteredOnAVSSaved,
    })
  }

  handleChange(e) {
    this.setState({ textInput: e.target.value });
  }

  constructor(props) {
    super(props)
    this.createNewTask = this.createNewTask.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.mainFunction = this.mainFunction.bind(this);
    this.registerOperator = this.registerOperator.bind(this);
    var tasksMap = new Map();
    this.state = { 
      account: '', 
      tasksMap: tasksMap, 
      tasksArray: [], 
      textInput: "", 
      operatorRegisteredOnEL: false,
      operatorRegisteredOnAVS: false,
     }
  }

  render() {
    return (
      <div className="container">
        <h1>Hello, World!</h1>
        <p>Your account: {this.state.account}</p>
        <p>Total Tasks: {this.state.tasksArray.length}</p>
        <p>Latest Task Number: {this.state.latestTaskNum}</p>
        <p>Latest Task Hashe: {this.state.allTaskHashes}</p>
        <p>Latest Task Response: {this.state.allTaskResponses}</p>
        
        <input type="text" onChange={ this.handleChange } />
        <input
          type="button"
          value="Click to create new task"
          onClick={()=>this.createNewTask()}
        />
        <p>Your new task name will be: {this.state.textInput}</p>
        <p>operatorRegisteredOnEL: {this.state.operatorRegisteredOnEL + ""}</p>
        <p>operatorRegisteredOnAVS: {this.state.operatorRegisteredOnAVS + ""}</p>
        {this.state.operatorRegisteredOnEL===false && this.state.operatorRegisteredOnAVS===false && (
          <div>
          <button onClick={()=>this.mainFunction()}>Register Operator</button>
          </div>
        )}
        {/* <ul>
          {this.state.tasksArray.map((task, index) => (
            <li key={index}>
              {task}
            </li>
          ))}
        </ul>
        <ul>
          {Array.from(this.state.tasksMap).map(([task, values], index) => (
            <li key={index}>
              {task} and {values.receipt} and {values.taskCreatedBlock} and {values.taskIndex} and {values.signed+""}
            </li>
          ))}
        </ul> */}
        <TableContainer component={Paper}>
          <Table sx={{ minWidth: 700 }} aria-label="customized table">
            <TableHead>
              <TableRow>
                <StyledTableCell>Task Name</StyledTableCell>
                <StyledTableCell align="right">Tx Receipt</StyledTableCell>
                <StyledTableCell align="right">Task Created Block&nbsp;</StyledTableCell>
                <StyledTableCell align="right">Task Index&nbsp;</StyledTableCell>
                <StyledTableCell align="right">Is Signed&nbsp;</StyledTableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Array.from(this.state.tasksMap).map(([task, values], index) => (
                <StyledTableRow key={index}>
                  <StyledTableCell component="th" scope="row">
                  {task}
                  </StyledTableCell>
                  <StyledTableCell align="right">{values.receipt} </StyledTableCell>
                  <StyledTableCell align="right">{values.taskCreatedBlock}</StyledTableCell>
                  <StyledTableCell align="right">{values.taskIndex} </StyledTableCell>
                  <StyledTableCell align="right">{values.signed!==undefined && values.signed+""}</StyledTableCell>
                </StyledTableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </div>  
    );
  }
}

export default App;