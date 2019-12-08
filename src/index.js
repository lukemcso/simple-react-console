import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Key, Mode, InputType } from './constants';
import './console.css';

const style = {
  root: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  header: {
    backgroundColor: '#D9D9D9',
    height: '20px',
    borderRadius: '5px 5px 0 0',
    position: 'absolute',

    left: 0,
    right: 0,
  },
  graphics: {
    backgroundColor: '#000000',
    display: 'fixed',
  },
  container: {
    color: '#FAFAFA',
    overflowWrap: 'break-word',
    display: 'block',
    whiteSpace: 'pre-wrap',
    overflow: 'hidden',
    overflowY: 'hidden',
    textAlign: 'left',
    maxHeight: '100%',
    paddingLeft: '1rem',
    paddingRight: '1rem',
    bottom: '10px',
  },
  consoleTag: { color: '#7BC02D' },
};

const Console = ({ ...props }) => {
  //set props as const
  const { setOutput, onResponse, onComplete, loop, showHeader, hideTags, passive } = props;

  //Setup state controls
  const [consoleReceiving, setConsoleReceiving] = useState(false);
  const [currentOutput, setCurrentOutput] = useState({ string: '' });
  const [currentInput, setCurrentInput] = useState('');
  const [transition, setTransition] = useState(false);
  const [focused, setFocused] = useState(props.focus);
  const [overflow, setOverflow] = useState('hidden');
  const [storyMode, setStoryMode] = useState(false);
  const [storyIndex, setStoryIndex] = useState(0);
  const [inputValue, setInput] = useState([]);
  const [ctrl, setCtrl] = useState(false);
  const [tick, setTick] = useState(0);

  // Ref to monitor change in scroll area
  const scrollContainer = useRef();

  // settable values
  const [headerBackgroundColor] = useState(
    props.headerBackgroundColor ? props.headerBackgroundColor : '#D9D9D9',
  );
  const [headerShadow] = useState(
    props.shadow ? ' 0 4px 8px 0 rgba(0, 0, 0, 0.2), 0 6px 20px 0 rgba(0, 0, 0, 0.19)' : '',
  );
  const [backgroundColor] = useState(props.backgroundColor ? props.backgroundColor : '#000000');
  const [consoleTag] = useState(props.consoleTag ? props.consoleTag : 'console');
  const [contentPadding] = useState(props.showHeader ? '30px 10px 10px 10px' : '10px');
  const [borderRadius] = useState(props.showHeader ? '10px 10px 0 0' : '0');
  const [textColor] = useState(props.textColor ? props.textColor : '#FAFAFA');
  const [tagColor] = useState(props.tagColor ? props.tagColor : '#7BC02D');
  const [userTag] = useState(props.userTag ? props.userTag : consoleTag);
  const [height] = useState(props.height ? props.height : '100%');
  const [width] = useState(props.width ? props.width : '100%');
  const [delay] = useState(props.speed ? props.speed : 50);
  const [tag] = useState(props.tag ? props.tag : '~$ ');
  const [scroll] = useState(props.scroll);

  const onClick = () => {
    // create a custom event to warn any other console
    // on the page that this console is now going to
    // be selected
    const event = new Event('console_focus');
    // Dispatch the event.
    window.dispatchEvent(event);
    setFocused(true);
  };

  useEffect(() => {
    window.addEventListener('console_focus', console_focus);
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('mousedown', mousedown);
    return () => {
      window.removeEventListener('console_focus', console_focus);
      window.removeEventListener('mousedown', mousedown);
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  });

  // listen for the custom focus event. signifies a console is in
  // focus and other consoles should lose there focus
  const console_focus = () => {
    setFocused(false);
  };

  // listen for mouse events to deselect the console
  const mousedown = (event) => {
    setFocused(false);
  };

  // Capture key events on the down press
  const onDown = (event) => {
    if (!focused || passive) {
      return;
    }

    //if receiving input from the user, pass the keys
    //as a controlInput
    if (consoleReceiving) {
      controlInput(event);
    } else {
      controlOutput(event);
    }
  };

  // listen for up event, used to clear blocking keys
  // such as the ctrl key
  const onUp = (event) => {
    if (!focused || passive) {
      return;
    }
    switch (event.code) {
      case Key.CONTROL_LEFT:
      case Key.CONTROL_RIGHT:
        setCtrl(false);
        break;
      default:
        //default up
        break;
    }
  };

  //manage input from the user
  const controlInput = (event) => {
    let val = '';
    let replace = false;

    //cancel input if control key is pressed
    if (ctrl) {
      controlSpecialInput(event);
      return;
    }

    switch (event.code) {
      case Key.BACKSPACE: //delete last char from the current string
        val =
          currentInput.length > 0 ? (val = currentInput.slice(0, currentInput.length - 1)) : val;
        replace = true;
        break;
      case Key.SPACE: //add a space char to the current string
        event.preventDefault();
        val = '\xa0';
        break;
      case Key.ENTER: //trigger a new line or response
        enterKeyPressed();
        break;
      case Key.CONTROL_LEFT: //mark ctrl as pressed
      case Key.CONTROL_RIGHT:
        setCtrl(true);
        break;
      default:
        //assign key if key code is length 1, i.e a letter, number or symbol
        //first check for restrictions on input type
        val = processKeyInput(event);

        break;
    }

    //if an input key has been pressed or a delete key
    //update the current input
    if (val !== '' || replace) {
      updateCurrentValue(val, replace);
    }
  };

  // Check key input for any restrictions - these are
  // Number only: If a letter or symbol is pressed do not
  // update the string
  // Max length: If inputed value is longer that max chars
  // do not add the last char to the string
  const processKeyInput = (event) => {
    let val = '';

    let type = '';

    if (currentOutput) {
      const co = currentOutput[storyIndex] ? currentOutput[storyIndex] : currentOutput;
      if (co.type) {
        type = co.type;
      }

      let max = co.max ? co.max : -1;
      if (storyMode && co[storyIndex] && co[storyIndex].type) {
        type = co[storyIndex].type;
      }
      if (storyMode && co[storyIndex] && co[storyIndex].max) {
        max = co[storyIndex].max ? co[storyIndex].max : -1;
      }

      if (max > -1 && currentInput.length >= max) {
        return val;
      }
    }

    switch (type) {
      case InputType.NUMBER:
        val = !isNaN(event.key) ? event.key : '';
        break;
      default:
        val = event.key.length === 1 ? event.key : '';
        break;
    }
    return val;
  };

  //Trigger actions on special situations
  //such as ctrl+v to paste
  const controlSpecialInput = (event) => {
    switch (event.key) {
      case Key.V:
        //TODO: complete the line on paste
        break;
      default:
        break;
    }
  };

  // append the current user string with the updated char
  const updateCurrentValue = (val, replace) => {
    let input = !replace ? currentInput + val : val;
    setCurrentInput(input);
    let newInput = [...inputValue];
    const i = newInput.length === 0 ? 0 : newInput.length - 1;
    newInput[i] = { tag: getCompleteTag(), input: input };
    setInput(newInput);
  };

  // Get tag to use as the output. This can be different depending on
  // input or output
  // tag is used to set the end value, default as: ~$
  const getCompleteTag = useCallback(
    (receive) => {
      let name = consoleTag;
      if ((receive && receive === Mode.RECEIVE) || (!receive && consoleReceiving)) {
        name = userTag;
      }

      const t = name + tag + '\xa0';
      return t;
    },
    [consoleReceiving, tag, userTag, consoleTag],
  );

  // Listen for key events when console is in output mode
  const controlOutput = (event) => {
    switch (event.code) {
      case Key.ENTER: //finish current output when enter is pressed
        if (transition && !storyMode) {
          completeOutputString();
        }
        break;
      default:
        break;
    }
  };

  // If chars are remaining update the current output string
  const completeOutputString = () => {
    if (!currentOutput) {
      return;
    }
    let co = currentOutput[storyIndex] ? currentOutput[storyIndex].string : currentOutput;
    if (co.string) {
      co = co.string;
    }
    if (co) {
      let val = co.slice(tick, co.length);
      completeOutput(val, Mode.RECEIVE);
    }
  };

  // Once an output or input round has complete. Clear up status and
  // update the board
  const completeOutput = (finalOutput, receiving) => {
    if (storyMode && storyIndex < setOutput.length - 1) {
      finishLine(finalOutput);
      setTick(0);
      setStoryIndex(storyIndex + 1);
      addNewLine('', false);
      setCurrentInput('');
    } else {
      if (onComplete && !loop) {
        onComplete();
      } else if (storyMode && loop) {
        setStoryIndex(-1);
        return;
      }
      setTransition(false);
      setConsoleReceiving(true);
      setCurrentInput('');
      addNewLine(finalOutput, receiving);
    }
  };

  // On return key press during user input, complete
  // response and trigger response if applicable
  const enterKeyPressed = () => {
    addNewLine('', Mode.INPUT);
    setCurrentInput('');
    if (onResponse) {
      if (storyMode) {
        setStoryMode(false);
      }
      let id = '';
      if (storyMode && currentOutput && currentOutput[storyIndex]) {
        id = currentOutput[storyIndex].id;
      } else if (currentOutput) {
        id = currentOutput.id;
      }
      onResponse({ value: currentInput, id: id });
    }
  };

  //finish last line
  const finishLine = (finalOutput) => {
    const currentInputVal = inputValue;
    if (finalOutput && currentInputVal[currentInputVal.length - 1]) {
      currentInputVal[currentInputVal.length - 1].input =
        currentInputVal[currentInputVal.length - 1].input + finalOutput;
    }

    setInput(currentInputVal);
  };

  const updateScrollPosition = () => {
    //reposition window if content is scrolling off screen
    if (scrollContainer.current.offsetHeight !== scrollContainer.current.scrollHeight) {
      scrollContainer.current.scrollTop =
        scrollContainer.current.scrollHeight - scrollContainer.current.offsetHeight;

      if (scroll) {
        setOverflow('scroll');
      }
    } else {
      if (scroll) {
        setOverflow('hidden');
      }
    }
  };
  //add a new line to the console
  const addNewLine = (finalOutput, receiving) => {
    const currentInputVal = inputValue;
    if (finalOutput && currentInputVal[currentInputVal.length - 1]) {
      currentInputVal[currentInputVal.length - 1].input =
        currentInputVal[currentInputVal.length - 1].input + finalOutput;
    }

    const newLine = { tag: getCompleteTag(receiving), input: '' };
    setInput([...currentInputVal, newLine]);
    updateScrollPosition();
  };

  //timer event to animate the output of letters
  useInterval(
    () => {
      let st = currentOutput;
      if (storyMode && currentOutput && currentOutput[storyIndex]) {
        st = currentOutput[storyIndex].string;
      } else if (currentOutput) {
        st = currentOutput.string;
      } else {
        st = '';
      }

      if (st && tick < st.length) {
        const char = st[tick];
        setTick(tick + 1);
        setConsoleReceiving(false);
        updateCurrentValue(char);
      } else {
        completeOutput('', Mode.RECEIVE);
      }

      // update scroll height every 100 ticks
      if (tick % 100 === 99) {
        updateScrollPosition();
      }
    },
    delay,
    transition,
  );

  //monitor changes in output values
  useEffect(() => {
    if (
      currentOutput === '' ||
      (currentOutput !== setOutput && typeof setOutput !== 'string') ||
      (typeof setOutput === 'string' && currentOutput && currentOutput.string !== setOutput)
    ) {
      if (Array.isArray(setOutput)) {
        setStoryIndex(0);
        setStoryMode(true);
      } else {
        setStoryMode(false);
      }
      if (typeof setOutput === 'string') {
        setCurrentOutput({ string: setOutput });
      } else {
        setCurrentOutput(setOutput);
      }

      setTick(0);

      setTransition(true);
      setConsoleReceiving(false);
      if (inputValue.length > 0) {
        let newInputVal = [...inputValue];
        let val = inputValue[inputValue.length - 1];
        val = { ...val, tag: getCompleteTag() };

        newInputVal[newInputVal.length - 1] = val;
        setInput(newInputVal);
      }
    }
  }, [currentOutput, setCurrentOutput, setOutput, setTransition, inputValue, getCompleteTag]);

  //create and output the text list
  let list = [];
  inputValue.forEach((item, i) => {
    if (list.length > 0) {
      list.push(<br key={'br' + i} />);
    }
    list.push(
      <span key={'span' + i}>
        {hideTags ? null : (
          <span key={'tag' + i} style={{ ...style.consoleTag, color: tagColor }}>
            {i <= inputValue.length - 1 ? item.tag : getCompleteTag()}
          </span>
        )}
        <span key={'input' + i}>{item.input}</span>
      </span>,
    );
  });

  //render the list
  return (
    <div
      style={{
        ...style.root,
        maxWidth: width,
        height: height,
        maxHeight: height,
      }}>
      {showHeader ? (
        <div
          style={{
            ...style.header,
            backgroundColor: headerBackgroundColor,
            maxWidth: width,
          }}
        />
      ) : null}
      <div
        style={{
          ...style.graphics,
          backgroundColor: backgroundColor,
          height: height,
          boxShadow: headerShadow,
          borderRadius: borderRadius,
        }}
        onClick={onClick}>
        <div
          style={{
            maxWidth: width,
            overflowY: overflow,
            borderRadius: borderRadius,
            backgroundColor: backgroundColor,
            color: textColor,
          }}
          className={
            'container ' + (focused ? 'blink' : 'stopped') + (showHeader ? ' headerActive' : '')
          }
          ref={scrollContainer}>
          {list}
        </div>
      </div>
    </div>
  );
};

function useInterval(callback, delay, transition) {
  const savedCallback = useRef();

  // Remember the latest callback.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval.
  useEffect(() => {
    function tick() {
      savedCallback.current();
    }
    if (transition && delay !== null) {
      let id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay, transition]);
}

export default Console;
