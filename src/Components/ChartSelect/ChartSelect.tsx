import React from 'react'
import './ChartSelect.scss'
import Select from 'react-select'
import { ExerciseSelectType } from '../../types'
import styles from '../../_exports.module.scss'

const customStyles = {
  control: (provided: any, state: any) => ({
    ...provided,
    background: styles.primaryBackground,
    minHeight: '40px',
    height: '40px',
    minWidth: '100%',
    boxShadow: state.isFocused ? null : null,
    border: `1px solid ${styles.borderColor}`,

    ':active': {
      outline: `2px solid ${styles.borderColor}`,
      outlineOffset: '2px',
    },
    ':hover': {
      outline: 'none',
    },
  }),
  singleValue: (provided: any) => ({
    ...provided,
    color: styles.primaryText,
    fontWeight: '500',
    paddingBottom: '3px',
  }),

  valueContainer: (provided: any) => ({
    ...provided,
    height: '40px',
    padding: '0 6px',
  }),

  input: (provided: any) => ({
    ...provided,
    margin: '0px',
    color: styles.primaryText,
  }),
  indicatorSeparator: () => ({
    display: 'none',
  }),
  indicatorsContainer: (provided: any) => ({
    ...provided,
    height: '40px',
  }),
  placeholder: (provided: any) => ({
    ...provided,
    fontWeight: '500',
    color: '#bebebe',
  }),
  menu: (provided: any) => ({
    ...provided,
    background: styles.primaryBackground,
    border: `1px solid ${styles.borderColor}`,
  }),
  selectContainer: (provided: any) => ({
    ...provided,
    background: styles.primaryBackground,
    border: `1px solid ${styles.borderColor}`,
  }),
  option: (provided: any, state: any) => ({
    ...provided,
    background: state.isFocused ? styles.secondary : styles.primaryBackground,
    ':hover': {
      background: styles.secondary,
    },
  }),
}

type ChartSelectProps = {
  options: ExerciseSelectType[]
  selectedOption: ExerciseSelectType | null
  setSelectedOption: React.Dispatch<
    React.SetStateAction<ExerciseSelectType | null>
  >
}
const ChartSelect = ({
  options,
  selectedOption,
  setSelectedOption,
}: ChartSelectProps) => {
  const handleSelectChange = (e: any) => {
    setSelectedOption(e)
  }

  return (
    <Select
      options={options}
      styles={customStyles}
      className='select'
      value={selectedOption}
      onChange={handleSelectChange}
      placeholder='Select Exercise...'
    />
  )
}

export default ChartSelect
