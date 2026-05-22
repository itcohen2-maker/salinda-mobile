import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import {
  EquationResultCube,
  getEquationResultVisualState,
} from '../../index';

describe('getEquationResultVisualState', () => {
  it('returns placeholder for an incomplete equation', () => {
    expect(
      getEquationResultVisualState({
        finalResult: null,
        hasError: false,
        tutorialTarget: null,
      }),
    ).toBe('placeholder');
  });

  it('returns ready for a numeric result even when it is not confirmable yet', () => {
    expect(
      getEquationResultVisualState({
        finalResult: 19,
        hasError: false,
        tutorialTarget: null,
        ok: false,
      }),
    ).toBe('ready');
  });

  it('returns ready for a numeric result even when it is confirmable', () => {
    expect(
      getEquationResultVisualState({
        finalResult: 19,
        hasError: false,
        tutorialTarget: null,
        ok: true,
      }),
    ).toBe('ready');
  });

  it('returns error before any other visual state', () => {
    expect(
      getEquationResultVisualState({
        finalResult: null,
        hasError: true,
        tutorialTarget: 7,
      }),
    ).toBe('error');
  });

  it('returns tutorial-target without falling back to the old green success state', () => {
    expect(
      getEquationResultVisualState({
        finalResult: null,
        hasError: false,
        tutorialTarget: 7,
      }),
    ).toBe('tutorial-target');
  });
});

describe('EquationResultCube', () => {
  it('renders an opaque placeholder question mark', () => {
    render(<EquationResultCube visualState="placeholder" displayValue="?" />);

    const box = screen.getByTestId('equation-result-box');
    const value = screen.getByTestId('equation-result-value');
    const boxStyle = StyleSheet.flatten(box.props.style);
    const valueStyle = StyleSheet.flatten(value.props.style);

    expect(value.props.children).toBe('?');
    expect(boxStyle.backgroundColor).toBe('#FFF1D6');
    expect(boxStyle.borderColor).toBe('#9A3412');
    expect(valueStyle.color).toBe('rgba(122,31,21,0.48)');
  });

  it('renders the ready state as a stronger warm cube, not green', () => {
    render(<EquationResultCube visualState="ready" displayValue="19" />);

    const box = screen.getByTestId('equation-result-box');
    const value = screen.getByTestId('equation-result-value');
    const boxStyle = StyleSheet.flatten(box.props.style);
    const valueStyle = StyleSheet.flatten(value.props.style);

    expect(value.props.children).toBe('19');
    expect(boxStyle.backgroundColor).toBe('#FFE7B8');
    expect(boxStyle.borderColor).toBe('#B45309');
    expect(boxStyle.backgroundColor).not.toBe('#166534');
    expect(valueStyle.color).toBe('#6B210F');
  });

  it('renders tutorial-target with the same warm palette instead of green', () => {
    render(<EquationResultCube visualState="tutorial-target" displayValue="7" />);

    const box = screen.getByTestId('equation-result-box');
    const value = screen.getByTestId('equation-result-value');
    const boxStyle = StyleSheet.flatten(box.props.style);

    expect(value.props.children).toBe('7');
    expect(boxStyle.backgroundColor).toBe('#FFE7B8');
    expect(boxStyle.borderColor).toBe('#B45309');
    expect(boxStyle.backgroundColor).not.toBe('#166534');
  });

  it('renders error as a red cube with a question mark', () => {
    render(<EquationResultCube visualState="error" displayValue="?" />);

    const box = screen.getByTestId('equation-result-box');
    const value = screen.getByTestId('equation-result-value');
    const boxStyle = StyleSheet.flatten(box.props.style);
    const valueStyle = StyleSheet.flatten(value.props.style);

    expect(value.props.children).toBe('?');
    expect(boxStyle.backgroundColor).toBe('#DC2626');
    expect(boxStyle.borderColor).toBe('#B91C1C');
    expect(valueStyle.color).toBe('#FFFFFF');
  });
});
