/**
 * This file contains the public API of the URL Parsing and Matching library 'mimurl'.
 *
 * To read about mimurl features
 * <a href="https://mmichlin66.github.io/mimurl/mimurlAbout.html" target="_top">please visit here</a>.
 *
 * To play with mimurl pattern parsing and URL matching capabilities
 * <a href="https://mmichlin66.github.io/mimurl/mimurlDemo.html" target="_top">please visit here</a>.
 */

/**
 * The ParsedActualURL class contains URL parts parsed out of the URL string.
 */
export interface IParsedActualURL
{
	/** Protocol URL part */
	protocol?: string;

	/** Hostname URL part as array of hostname segments: e.g. `["www", "abc", "com"]` */
	hostname?: string[];

	/** Port URL part */
	port?: number;

	/** Path URL part as array of path segments: e.g. `["user", "123", "profile"]` */
	path?: string[];

	/** Query string URL part as a map of query string parameters to the arrays of their values */
	query?: { [P: string]: string[] };

	/** Hash (fragment) URL part */
	hash?: string;
}



/**
 *  The UrlPart enumeration provides values distinguishing URL parts.
 */
export enum EUrlPart { Protocol, Hostname, Port, Path, Query, Hash }



/**
 * The IParsedUrlPattern interface represents the top-level object describing the result of URL
 */
export interface IParsedUrlPattern
{
	/** Original pattern string for which this object was created. */
	patternString: string;

	/** Protocol URL part. */
	protocol: IParsedSingleSegmentUrlPart;

	/** Hostname URL part. */
	hostname: IParsedMultiSegmentUrlPart;

	/** Port URL part. */
	port: IParsedSingleSegmentUrlPart;

	/** Path URL part. */
	path: IParsedMultiSegmentUrlPart;

	/** Query String URL part. */
	query: IParsedQueryString;

	/** Hash URL part. */
	hash: IParsedSingleSegmentUrlPart;

	/** Array of URL part. Indexes are values from the UrlPart enumeration. */
	parts: IParsedUrlPart[];
}



/**
 * The ParsedLocation type defines how different section of the URL pattern can be located in the
 * original pattern string. Location is defined using the zero-based index where the section
 * begins and its length.
 */
export type ParsedLocation = { start: number, length: number };



/**
 * The IParsedToken is a base interface that contains information common to all parsed URL parts.
 */
export interface IParsedToken
{
	/**
	 * Location of the part in the original pattern string containing the zero-based index where
	 * the part begins and its length.
	 */
	location: ParsedLocation;

	/** Content of the token */
	tokenSting: string;
}



/**
 * The IParsedUrlPart is a base interface that contains information common to all parsed URL parts.
 */
export interface IParsedUrlPart extends IParsedToken
{
	/** URL part this object represents. */
	urlPart: EUrlPart;

	/** Flag indicating whether the comparison of this part shold be case-sensitive or not. */
	caseSensitive: boolean;

	/** Returns array of segments in this part. */
	getSegments(): IParsedSegment[];
}



/**
 * The IParsedSingleSegmentUrlPart class contains information that is common for URL parts that
 * define a single segment: protocol, port and hash.
 */
export interface IParsedSingleSegmentUrlPart extends IParsedUrlPart
{
	/** URL part this object represents. */
	segment: IParsedSegment;
}



/**
 * The IParsedMultiSegmentUrlPart interface contains information that is common for URL parts that
 * can define multiple segments: hostname and path.
 */
export interface IParsedMultiSegmentUrlPart extends IParsedUrlPart
{
	/** URL part this object represents. */
	segments: IParsedSegment[];
}



/**
 * The IParsedQueryString interface contains information that allows matching query string
 * parameters.
 */
export interface IParsedQueryString extends IParsedUrlPart
{
	/** Query string defines one segement per each parameter name. */
	parsedQSPs: { [P: string]: IParsedQSP };

	/**
	 * Flag indicating whether query string parameters not specified explicitly in the pattern
	 * will be allowed when parsing actual URLs.
	 */
	allowExtraQueryParams: boolean;
}



/**
 * The IParsedQSP interface contains information about matching a single query string parameter.
 */
export interface IParsedQSP extends IParsedToken
{
	/** Query string parameter name. */
	name: string;

	/** Query String defines one segement per each parameter name. */
	segment: IParsedSegment;
}



/**
 * The IParsedSegment interface defines a single segment in a URL pattern that can be matched to
 * one or more parts of an actual URL. Each segment can have zero or more fields defined in it.
 */
export interface IParsedSegment extends IParsedToken
{
	/** Flag indicating whether the segment is optional */
	isOptional: boolean;

	/**
	 * Flag indicating whether the segment can be repeated mutiple times. Segments that are both
	 * optional and multi can be repeated zero or more times. Segments that are not optional but
	 * multi can be repeated one or more times.
	 */
	isMulti: boolean;

	/** Array of fields defined in this segment. */
	fields: IParsedField[];

	// Regular expression representing the segment's match pattern.
	regExp: RegExp;
}



/**
 * The IParsedField interface defines a single field within a segment.
 */
export interface IParsedField extends IParsedToken
{
	/** Flag indicating whether the field is optional */
	isOptional: boolean;

	/** Name of the field */
	name: string;

	/** Field format */
	format: FieldFormat;

	/** Optional default value of the field */
	defaultValue?: FieldValueType;

	// /** Regular expression string describing the matching pattern for the field */
	// matchPattern: IParsedRegExp;

	// Flag indicating whether the field value is an array. This is true for fields that can appear
	// multiple times in the URL part.
	isArray: boolean;

	// Index of the regular expression capturing group corresponding to the field within the
	// segment.
	index: number;
}



/**
 * The FieldFormat class defines possible field formats.
 */
export enum FieldFormat
{
	/** Field value can be arbitrary string */
	String,

	/** Field value must be convertable to an integer number */
	Integer,

	/** Field value must be convertable to a real number */
	Float,

	/** Field value must be convertable to a Boolean number */
	Boolean,
}



/**
 * The IUrlPatternParsingException interface represents an error that occurred during parsing of
 * a URL pattern.
 */
export interface IUrlPatternParsingException extends Error
{
	/** Index in the pattern string at which theerror occurred. */
	pos: number;
}



/** Supported primitive types of field values */
export type SingleFieldValueType = string | number | boolean;

/** Types of fields with multiple values */
export type MultiFieldValueType = SingleFieldValueType[];

/** Field value type, which can be either singe value or multiple value type */
export type FieldValueType = SingleFieldValueType | MultiFieldValueType;

/** Object containing properties whose names are field names and values are field values. */
export type FieldBag = { [P:string]: FieldValueType };



/**
 * The IUrlPatternMatchResult interface represents the result of matching an actual URL against
 * the URL pattern. The result contains values of named and indexed fields.
 */
export interface IUrlPatternMatchResult
{
	/** Flag indicating whether the match was successul */
	success: boolean;

	/** Parsed actual URL */
	parsedURL: IParsedActualURL;

	/** Error messages in case the match was not successful */
	errors?: string[];

	/** Field names and values */
	fields?: FieldBag;
}



import * as actual from "./actual";
import * as parser from "./parser";
import * as matcher from "./matcher";



/**
 * Parses the given URL 
 * @param s URL string to be parsed.
 */
export function parseURL( s: string): IParsedActualURL
{
	return actual.parseURL( s);
}

/**
 * Parses the given URL pattern
 * @param s URL pattern string to be parsed.
 */
export function parseUrlPattern( s: string): IParsedUrlPattern
{
	return parser.parsePattern( s);
}

/**
 * Matches the given URL against URL pattern string.
 * @param url Either unparsed URL string or [[IParsedActualURL]] object
 * @param pattern Either unparsed URL pattern string or [[IParsedUrlPattern]] object
 */
export function match( url: string | IParsedActualURL, pattern: string | IParsedUrlPattern): IUrlPatternMatchResult
{
	return matcher.match( url, pattern);
}



