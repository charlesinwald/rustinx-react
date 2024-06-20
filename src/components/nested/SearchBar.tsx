import React, { useState } from 'react';
import './nested.css'; // Import your CSS file
import magnifier from '../../../assets/magnifier.svg'; // Ensure paths are correct
import arrowDown from '../../../assets/arrow-down.svg'; // Ensure paths are correct

const SearchBar = () => {
  const [searchBy, setSearchBy] = useState('Option1');
  const [showDropdown, setShowDropdown] = useState(false);

  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
  };

  const handleSearchOptionClick = (option: string) => {
    setSearchBy(option);
    setShowDropdown(false);
  };

  const placeholderTexts = {
    Option1: 'Search by option1',
    Option2: 'Search by option2',
  };

  // const handleInputChange = (event) => {
  //   // console.log('Input changed:', event.target.value);
  // };
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('Input changed:', event.target.value);
  };
  return (
    <div className="search-bar-container">
      <div className="main">
        <div className={`drop-list ${showDropdown ? 'active' : ''}`}>
          <button type="button" className="srh-btn" onClick={toggleDropdown}>
            <svg
              id="magnifier"
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
            >
              <path
                d="M21.707 20.293l-5.656-5.656C17.139 13.203 18 11.213 18 9c0-4.971-4.029-9-9-9S0 4.029 0 9s4.029 9 9 9c2.213 0 4.203-.861 5.637-2.293l5.656 5.656c.39.39 1.023.39 1.414 0s.39-1.023 0-1.414zM2 9c0-3.859 3.141-7 7-7s7 3.141 7 7-3.141 7-7 7-7-3.141-7-7z"
                fill="currentColor"
              />
            </svg>
            <svg
              id="arrow"
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
            >
              <path d="M5 6l5 5 5-5 2 1-7 7-7-7z" fill="currentColor" />
            </svg>
            <p className="search-txt">{searchBy}</p>
          </button>
          {showDropdown && (
            <div className="dropdown-content">
              <div onClick={() => handleSearchOptionClick('Option1')}>
                Option1
              </div>
              <div onClick={() => handleSearchOptionClick('Option2')}>
                Option2
              </div>
              {/* Add more options here */}
            </div>
          )}
        </div>
        <div className="input-box">
          <input
            className="mn-input"
            name=""
            onChange={handleInputChange}
            placeholder={placeholderTexts[searchBy]}
          />
        </div>
      </div>
    </div>
  );
};

export default SearchBar;
