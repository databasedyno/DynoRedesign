import { Tuple, configureStore } from "@reduxjs/toolkit";
import createSagaMiddleware from "redux-saga";
import rootReducer from "./Redux/Reducers";
import RootSaga from "./Redux/Sagas/RootSaga";

const sagaMiddleware = createSagaMiddleware();
let browserWindow: any;
if (typeof window !== "undefined") browserWindow = window;

const store = configureStore({
  reducer: rootReducer,
  middleware: () => new Tuple(sagaMiddleware),
  devTools:
    browserWindow &&
    browserWindow.__REDUX_DEVTOOLS_EXTENSION__ &&
    browserWindow.__REDUX_DEVTOOLS_EXTENSION__(),
});

sagaMiddleware.run(RootSaga);

export default store;
