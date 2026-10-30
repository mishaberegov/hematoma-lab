export function inputGeneration(){
 let generation=0;
 return {begin(){return ++generation;},current(token){return token===generation;}};
}
