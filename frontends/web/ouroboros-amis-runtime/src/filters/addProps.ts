import { registerFilter } from 'amis'

function skipNoneObject(mapper: (raw: any) => any): (raw: any) => any {
  return (raw: any) => {
    if (typeof raw !== 'object') return raw
    if (Array.isArray(raw)) return raw
    return mapper(raw)
  }
}

function addProp(rawValue: object | object[], ...props: object[] | any[] | string[]): any {
  if (props.length === 0) return rawValue

  let adder: (raw: any) => any = raw => raw
  if (props.length === 1 && typeof props[0] === 'object') {
    const propsObj = props[0]
    if (Array.isArray(propsObj)) return rawValue
    adder = raw => ({ ...raw, ...propsObj})
  }

  if (props.length > 1 && props.length % 2 === 0) {
    const singleAdder = props.reduce((acc, key, index) => {
      if (index % 2 === 0) {
        acc[key] = props[index + 1]
      }
      return acc
    }, {} as object)
    adder = raw => ({ ...raw, ...singleAdder})
  }
  
  if (Array.isArray(rawValue)){
    return rawValue.map(skipNoneObject(adder))
  }
  return skipNoneObject(adder)(rawValue)
}

registerFilter('addAttribute', addProp)
registerFilter('addProps',addProp)
