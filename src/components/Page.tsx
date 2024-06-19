import React, { useState } from 'react';
import './components-style.css';
import bbb from '../../assets/view-list.svg';
import vvv from '../../assets/arrow-down.svg';
import eee from '../../assets/settings-2.svg';
import ggg from '../../assets/filter.svg';
import rrr from '../../assets/expand-collapse2.svg';
import ply from '../../assets/play.svg';
import pas from '../../assets/pause.svg';
import rpt from '../../assets/11111.svg';
import accessLogsData, { LogEntry } from './static/AccessLogsData';
import { 
  SearchBar,
} from "./nested/index";


const Page: React.FC = () => {
  const [isRed, setIsRed] = useState(true); 

  const toggleLight = () => {
    setIsRed(prevState => !prevState); 
  };

  return (
    <div className="page-container">
      <div className="filter-bar">
        <div className="filter-bar-l">
          <div className="b-wr">
            <button>
              <img src={eee} id="stg" alt="SVG Image" width="22" height="22" />
            </button>
            {/* <button id="vw-btn">
              <img src={bbb} alt="SVG Image" width="16" height="16" />
              <span>Funnel View</span>
              <img src={vvv} alt="SVG Image" width="16" height="16" />
            </button> */}
          </div>
          <div className="brd-div"></div>
          <div className="b-wr">
            <button id="flt-btn">
              <img src={ggg} id="" alt="SVG Image" width="20" height="20" />
              <span>Filter</span>
              <img src={vvv} alt="SVG Image" width="16" height="16" />
            </button>
            <button id="srr-btn">
              <img src={rrr} id="srrt" alt="SVG Image" width="16" height="16" />
              <span>Sort</span>
              <img src={vvv} alt="SVG Image" width="16" height="16" />
            </button>
          </div>
          <div className="brd-div"></div>
          {/* <p className="info">
            Total expected deal value: <span>$159,583.00</span>
          </p> */}
        
        <SearchBar />
        </div>
        <div className="filter-bar-r">
          <div className="ssh-status"  onClick={toggleLight}>
            <div className="led-box">
              <div className={isRed ? 'led-red' : 'led-green'}></div>
            </div>
            <p className="status-text">SSH Status</p>
          </div>
          <div className="brd-div"></div>
          <div className="brdd">
            <button className="ply">
              <img src={ply} alt="SVG Image" width="13" height="13" />
            </button>
            <button className="pas">
            <img src={pas}  alt="SVG Image" width="26" height="26" />
            </button>
            <button className="rpt">
            <img src={rpt}  alt="SVG Image" width="24" height="24" />
            </button>
          </div>
        </div>

      </div>
      <div className="table-wrapper">
        <div className="table-content">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Client IP</th>
                <th>Timestamp</th>
                <th>HTTP Method</th>
                <th>Requested URL</th>
                <th>HTTP Protocol</th>
                <th>Status Code</th>
                <th>Response Size</th>
                <th>Referer URL</th>
                <th>User Agent</th>
                <th>Request Duration</th>
              </tr>
            </thead>
            <tbody>
              {accessLogsData.map((log: LogEntry) => (
                <tr key={log.id}>
                  <td>{log.id}</td>
                  <td>{log.clientIP}</td>
                  <td>{log.timestamp}</td>
                  <td>{log.method}</td>
                  <td>{log.url}</td>
                  <td>{log.protocol}</td>
                  <td>{log.statusCode}</td>
                  <td>{log.responseSize}</td>
                  <td>{log.referer}</td>
                  <td>{log.userAgent}</td>
                  <td>{log.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Page;
