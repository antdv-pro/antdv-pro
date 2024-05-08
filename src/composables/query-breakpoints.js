export const breakpointsEnum = {
  xl: 1600,
  lg: 1199,
  md: 991,
  sm: 767,
  xs: 575,
}
export function useQueryBreakpoints() {
  const breakpoints = reactive(useBreakpoints(breakpointsEnum))
  const isMobile = breakpoints.smaller('sm')
  const isPad = breakpoints.between('sm', 'md')
  const isDesktop = breakpoints.greater('md')
  return {
    breakpoints,
    isMobile,
    isPad,
    isDesktop,
  }
}
