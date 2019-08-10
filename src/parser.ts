import * as api from "./api"



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Parser's entry function.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export function parsePattern( patternString: string): api.IParsedUrlPattern
{
	// initialize global variables
	g_patternString = patternString;
	g_patternStringLength = 0;
	g_currIndex = 0;
	g_currChar = '';

	if (!patternString)
		throw new UrlPatternParsingException( "URL pattern cannot be empty");

	g_patternStringLength = patternString.length;
	g_currChar = patternString[0];

	// Create the top-level parsing object and run the parsing process.
	let parsedPattern = new ParsedUrlPattern();
	parsedPattern.parse();
	return parsedPattern;
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Define "global" variables that will be available to all objects in this module
//
///////////////////////////////////////////////////////////////////////////////////////////////////

// Pattern string being parsed
let g_patternString: string;

// Length of the pattern string
let g_patternStringLength: number;

// Index of the character in the pattern string that the parser is currently working with.
let g_currIndex: number;

// Character in the pattern string under the current index.
let g_currChar: string;



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Define "global" functions that will be available to all objects in this module
//
///////////////////////////////////////////////////////////////////////////////////////////////////

// Determines if we reached the end of the pattern.
function g_isEnd(): boolean
{
	return g_currIndex >= g_patternStringLength;
}



// Throws exception if we reached the end of the pattern.
function g_checkEnd( reason?: string): void
{
	if (g_currIndex === g_patternStringLength)
	{
		let msg = "Unexpected end of URL pattern";
		if (reason)
			msg += ": " + reason;
		throw new UrlPatternParsingException( msg);
	}
}



// Moves the given number of characters from the current position.
function g_move( d: number = 1): boolean
{
	if (g_currIndex <= g_patternStringLength - d)
	{
		g_currIndex += d;
		g_currChar = g_patternString[g_currIndex];
		return true;
	}
	else
	{
		g_currIndex = g_patternStringLength;
		return false;
	}
}



// Moves to the given position in the buffer.
function g_moveTo( i: number): boolean
{
	g_currIndex = i;
	if (g_currIndex < g_patternStringLength)
	{
		g_currChar = g_patternString[g_currIndex];
		return true;
	}
	else
		return false;
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The ParsedUrlPattern class is the top-level object describing the result of URL parsing.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
class ParsedUrlPattern implements api.IParsedUrlPattern
{
	// Original pattern string for which this object was created.
	public patternString: string;

	// Protocol URL part.
	public get protocol(): api.IParsedSingleSegmentUrlPart
		{ return this.parts[api.EUrlPart.Protocol] as ParsedSingleSegmentUrlPart }

	// Hostname URL part.
	public get hostname(): api.IParsedMultiSegmentUrlPart
		{ return this.parts[api.EUrlPart.Hostname] as ParsedMultiSegmentUrlPart }

	// Port URL part.
	public get port(): api.IParsedSingleSegmentUrlPart
		{ return this.parts[api.EUrlPart.Port] as ParsedSingleSegmentUrlPart }

	// Path URL part.
	public get path(): api.IParsedMultiSegmentUrlPart
		{ return this.parts[api.EUrlPart.Path] as ParsedMultiSegmentUrlPart }

	// Query String URL part.
	public get query(): api.IParsedQueryString
		{ return this.parts[api.EUrlPart.Query] as ParsedQueryString }

	// Hash URL part.
	public get hash(): api.IParsedSingleSegmentUrlPart
		{ return this.parts[api.EUrlPart.Hash] as ParsedSingleSegmentUrlPart }

	// Array of URL part. Indexes are values from the UrlPart enumeration.
	public parts: ParsedUrlPart[];



	constructor()
	{
		this.patternString = g_patternString;
		this.parts = [];
	}



	// Parses the entire URL pattern part by part
	public parse(): void
	{
		// loop of parsing URL parts
		for( let part = this.findFirstUrlPart(); part !== null; part = part.getNextUrlPart())
		{
			part.parse();
			this.parts[part.urlPart] = part;
			if (g_isEnd())
				break;
		}
	}



	// Determines the first URL part the parser will be working on.
	private findFirstUrlPart(): ParsedUrlPart
	{
		if (g_currChar === "/")
		{
			if (g_patternStringLength > 1 && g_patternString[1] === "/")
			{
				g_move(2);
				return new ParsedHostname();
			}
			else
			{
				g_move();
				return new ParsedPath();
			}
		}
		else
		{
			let index = g_patternString.indexOf( "://");
			if (index > 0)
				return new ParsedProtocol();
			else if (index < 0)
				return new ParsedHostname();
			else
				throw new UrlPatternParsingException( "URL pattern cannot start from '://'");
		}
	}
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The ParsedToken is a base class that contains information common to all parsed URL parts.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
abstract class ParsedToken implements api.IParsedToken
{
	// Location of the part in the original pattern string containing the zero-based index where
	// the part begins and its length.
	location: { start: number, length: number };

	/** Content of the token */
	tokenSting: string;

	constructor()
	{
		this.location = { start: g_currIndex, length: 0 };
	}

	public finalize()
	{
		this.location.length = g_currIndex - this.location.start;
		this.tokenSting = g_patternString.substr( this.location.start, this.location.length);
	}
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The ParsedUrlPart is a base class that contains information common to all parsed URL parts.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
abstract class ParsedUrlPart extends ParsedToken implements api.IParsedUrlPart
{
	// URL part this object represents.
	urlPart: api.EUrlPart;

	// Flag indicating whether the comparison of this part shold be case-sensitive or not.
	caseSensitive: boolean;

	constructor( urlPart: api.EUrlPart, caseSensitive: boolean)
	{
		super();

		this.urlPart = urlPart;
		this.caseSensitive = caseSensitive;
	}

	// Parses this token
	public abstract parse(): void;

	// Determines and crates if necessary the next URL part based on the current character
	public abstract getNextUrlPart() : ParsedUrlPart;

	// Returns array of segments in this part.
	public abstract getSegments(): ParsedSegment[];
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The ParsedSingleSegmentUrlPart interface contains information that is common for URL parts that
// define a single segment: protocol, port and hash.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
abstract class ParsedSingleSegmentUrlPart extends ParsedUrlPart implements api.IParsedSingleSegmentUrlPart
{
	// URL part this object represents.
	segment: ParsedSegment;

	constructor( urlPart: api.EUrlPart, caseSensitive: boolean)
	{
		super( urlPart, caseSensitive);
	}

	public parse(): void
	{
		let segment = new ParsedSegment();
		segment.parse( this.getSegmentEndCharacters(), false, this.caseSensitive);
		this.segment = segment;
		this.finalize();
	}

	// Returns array of segments in this part.
	public getSegments(): ParsedSegment[] { return [this.segment]; }

	// Returns a string that contains character, which indicate segment end for the given URL part.
	public abstract getSegmentEndCharacters(): string;
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The ParsedMultiSegmentUrlPart class contains information that is common for URL parts that
// can define multiple segments: hostname and path.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
abstract class ParsedMultiSegmentUrlPart extends ParsedUrlPart implements api.IParsedMultiSegmentUrlPart
{
	// URL part this object represents.
	segments: ParsedSegment[];

	constructor( urlPart: api.EUrlPart, caseSensitive: boolean)
	{
		super( urlPart, caseSensitive);
		this.segments = [];
	}

	public parse(): void
	{
		let partEndCharacters = this.getPartEndCharacters();

		// parse segments until the current character is the end of the URL part
		while( !g_isEnd())
		{
			let segment = new ParsedSegment();
			segment.parse( this.getSegmentEndCharacters(), true, this.caseSensitive);
			this.segments.push( segment);
			if (partEndCharacters.indexOf( g_currChar) >= 0)
				break;
			else
				g_move();
		}

		this.finalize();
	}

	// Returns array of segments in this part.
	public getSegments(): ParsedSegment[] { return this.segments; }

	// Returns a string that contains character, which indicate segment end for the given URL part.
	public abstract getSegmentEndCharacters(): string;

	public abstract getPartEndCharacters(): string;
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The ParsedProtocol class contains information that allows matching URL protocol.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
class ParsedProtocol extends ParsedSingleSegmentUrlPart
{
	constructor() { super( api.EUrlPart.Protocol, false); }

	public getSegmentEndCharacters(): string { return ":"; }

	public getNextUrlPart() : ParsedUrlPart
	{
		if (g_currChar === ":" && g_currIndex + 2 < g_patternStringLength &&
			g_patternString[g_currIndex+1] === "/" && g_patternString[g_currIndex+2] === "/")
		{
			g_move(3);
			g_checkEnd();
			let part = new ParsedHostname();
			return part;
		}
		else
			throw new UrlPatternParsingException( `Invalid characters after protocol part`);
	}
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The ParsedHostname class contains information that allows matching URL hostname.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
class ParsedHostname extends ParsedMultiSegmentUrlPart
{
	constructor() { super( api.EUrlPart.Hostname, false); }

	public getSegmentEndCharacters(): string { return ".:/?#"; }

	public getPartEndCharacters(): string { return ":/?#"; }

	public getNextUrlPart() : ParsedUrlPart
	{
		if (g_currChar === ':')
		{
			g_move();
			g_checkEnd( "Port cannot be empty");
			return new ParsedPort();
		}
		else if (g_currChar === '/')
		{
			g_move();
			return g_isEnd() ? null : new ParsedPath();
		}
		else if (g_currChar === '?')
		{
			g_move();
			return g_isEnd() ? null : new ParsedQueryString();
		}
		else if (g_currChar === '#')
		{
			g_move();
			return g_isEnd() ? null : new ParsedHash();
		}
		else
			throw new UrlPatternParsingException( `Invalid character '${g_currChar}' after hostname segment`);
	}
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The ParsedPort class contains information that allows matching URL port.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
class ParsedPort extends ParsedSingleSegmentUrlPart
{
	constructor() { super( api.EUrlPart.Port, false); }

	public getSegmentEndCharacters(): string { return "/?#"; }

	public getNextUrlPart() : ParsedUrlPart
	{
		if (g_currChar === '/')
		{
			g_move();
			return g_isEnd() ? null : new ParsedPath();
		}
		else if (g_currChar === '?')
		{
			g_move();
			return g_isEnd() ? null : new ParsedQueryString();
		}
		else if (g_currChar === '#')
		{
			g_move();
			return g_isEnd() ? null : new ParsedHash();
		}
		else
			throw new UrlPatternParsingException( `Invalid character '${g_currChar}' after port part`);
	}
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The ParsedPath class contains information that allows matching URL path.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
class ParsedPath extends ParsedMultiSegmentUrlPart
{
	constructor() { super( api.EUrlPart.Path, true); }

	public getSegmentEndCharacters(): string { return "/?#"; }

	public getPartEndCharacters(): string { return "?#"; }

	public getNextUrlPart() : ParsedUrlPart
	{
		if (g_currChar === '?')
		{
			g_move();
			return g_isEnd() ? null : new ParsedQueryString();
		}
		else if (g_currChar === '#')
		{
			g_move();
			return g_isEnd() ? null : new ParsedHash();
		}
		else
			throw new UrlPatternParsingException( `Invalid character '${g_currChar}' after path segment`);
	}
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The ParsedQueryString class contains information that allows matching query string parameters.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
class ParsedQueryString extends ParsedUrlPart implements api.IParsedQueryString
{
	// Query string defines one segment per each parameter name.
	parsedQSPs: { [P: string]: api.IParsedQSP };

	// Flag indicating whether query string parameters not specified explicitly in the pattern
	// will be allowed when parsing actual URLs.
	allowExtraQueryParams: boolean;

	constructor()
	{
		super( api.EUrlPart.Query, true);

		this.parsedQSPs = {};
		this.allowExtraQueryParams = true;
	}

	public parse(): void
	{
		// parse segments until the current character is the end of the URL part
		while( !g_isEnd() && g_currChar !== '#')
		{
			if (g_currChar === '!')
			{
				// special case for disabling matching with extra query string parameters
				this.allowExtraQueryParams = false;
				g_move();
			}
			else
			{
				let qsp = new ParsedQSP();
				qsp.parse();
				if (qsp.name in this.parsedQSPs)
					throw new UrlPatternParsingException( `Query string parameter '${qsp.name}' appears more than once`);
				else
					this.parsedQSPs[qsp.name] = qsp;

				if (g_currChar === '&')
					g_move();
			}
		}

		this.finalize();
	}

	public getNextUrlPart() : ParsedUrlPart
	{
		if (g_currChar === '#')
		{
			g_move();
			return g_isEnd() ? null : new ParsedHash();
		}
		else
			throw new UrlPatternParsingException( `Invalid character '${g_currChar}' after query string segment`);
	}

	// Returns array of segments in this part.
	public getSegments(): ParsedSegment[]
	{
		let segments: ParsedSegment[] = [];

		// loop over query string parameters
		for( let qspName in this.parsedQSPs)
			segments.push( this.parsedQSPs[qspName].segment as ParsedSegment);

		return segments;
	}
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The ParsedHash class contains information that allows matching URL hash.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
class ParsedHash extends ParsedSingleSegmentUrlPart
{
	constructor() { super( api.EUrlPart.Hash, true); }

	public getSegmentEndCharacters(): string { return ""; }

	public getNextUrlPart() : ParsedUrlPart
	{
		return null;
	}
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The ParsedQSP class contains information about matching a single query string parameter.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
class ParsedQSP extends ParsedToken implements api.IParsedQSP
{
	// Query string parameter name.
	name: string;

	// Query String defines one segment per each parameter name.
	segment: api.IParsedSegment;

	constructor()
	{
		super();
		this.name = "";
	}

	public parse(): void
	{
		// get parameter name
		while( !g_isEnd() && "=&#".indexOf( g_currChar) < 0)
		{
			this.name += g_currChar;
			g_move();
		}

		if (!this.name)
			throw new UrlPatternParsingException( `Query string parameter doesn't have name`);
		else if (!isValidQueryParamName( this.name))
			throw new UrlPatternParsingException( `Query string parameter name '${this.name}' contains invalid character`);

		if (g_isEnd() || g_currChar !== '=')
			throw new UrlPatternParsingException( `Query string parameter '${this.name}' must be followed by '='`);

		g_move();
		g_checkEnd( `Query string parameter '${this.name}' doesn't have value`);
		let segment = new ParsedSegment();
		segment.parse( "&#", true, true);
		this.segment = segment;
		this.finalize();
	}

	private isNameEndCharacter( c: string)
	{
		return "=&#".indexOf( c) >= 0;
	}
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The ParsedSegment class defines a single segment in a URL pattern that can be matched to one
// or more parts of an actual URL. Each segment can have zero or more fields defined in it.
// A field is defined either with or without a name. Unnamed fields are also called
// anonymous and they are associated with an index. When the URL pattern is parsed into segments,
// the anonymous fields are numbered sequentially accross multiple segments. That means that
// indexes do not restart for each segment and thus indexes for a segment's fields may not
// start from zero.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
class ParsedSegment extends ParsedToken implements api.IParsedSegment
{
	// Flag indicating whether the segment is optional
	isOptional: boolean;

	// Flag indicating whether the segment can be repeated mutiple times. Segments that are both
	// optional and multi can be repeated zero or more times. Segments that are not optional but
	// multi can be repeated one or more times.
	isMulti: boolean;

	/** Array of fields. */
	fields: ParsedField[];

	// Regular expression representing the segment's match pattern.
	regExp: RegExp;



	constructor( )
	{
		super();

		this.isOptional = false;
		this.isMulti = false;
		this.fields = [];
	}



	public parse( segmentEndChars: string, isPotentiallyMulti: boolean, caseSensitive: boolean): void
	{
		// analyze the first character in the segment and if it was a special character that
		// determines the segments optional and multi flags, move to the next character.
		if (this.analizeFirstChar( segmentEndChars, isPotentiallyMulti))
			g_move();

		// match pattern of the segment consisting of elements each of which is either text or
		// regular expression or field
		let matchPattern: (ParsedText | ParsedField | ParsedRegExp)[] = [];

		// parse tokens in the segment (text, regexp, fields) until either we reach the end of
		// the entire URL pattern or we encounter a segment delimiter
		while( !g_isEnd() && segmentEndChars.indexOf( g_currChar) < 0)
		{
			let token: ParsedText | ParsedField | ParsedRegExp;
			if (g_currChar === '{')
			{
				let field = new ParsedField();
				field.parse( segmentEndChars);
				token = field;
			}
			else if (g_currChar === '(')
			{
				let regExp = new ParsedRegExp();
				regExp.parse();
				token = regExp;
			}
			else
			{
				let text = new ParsedText();
				text.parse( segmentEndChars + "{(");
				token = text;
			}

			matchPattern.push( token);
		}

		this.generateRegExp( matchPattern, caseSensitive);
		this.finalize();
	}



	// Analizes the first character in the segment and returns true if it is a special character
	// that determines whether the segment is optional and whether it is "multi".
	private analizeFirstChar( segmentEndChars: string, isPotentiallyMulti: boolean): boolean
	{
		switch( g_currChar)
		{
			case '?': this.isOptional = true; return true;
			case '!': return true;

			case '*':
			{
				if (!isPotentiallyMulti)
					throw new UrlPatternParsingException( `Single-value segment URL part cannot start from '*'`);

				this.isOptional = this.isMulti = true;
				return true;
			}

			case '+':
			{
				if (!isPotentiallyMulti)
					throw new UrlPatternParsingException( `Single-segment URL part cannot start from '+'`);

				this.isMulti = true;
				return true;
			}

			default:
			{
				if (segmentEndChars.indexOf( g_currChar) >= 0)
					throw new UrlPatternParsingException( `Empty segment encountered`);
				else
					return false;
			}
		}
	}



	// Creates regular expression describing the segment.
	private generateRegExp( matchPattern: (ParsedText | ParsedField | ParsedRegExp)[],
					caseSensitive: boolean): void
	{
		// 1-based index of the RegExp capturing group. We need to count capturing groups in
		// order to later get values of named and anonymous fields.
		let nextCapturingGroupIndex = 1;

		let regExpString = "";
		if (matchPattern.length === 0)
			regExpString += ".+";
		else
		{
			for( let token of matchPattern)
			{
				if (token instanceof ParsedText)
					regExpString += token.content;
				else if (token instanceof ParsedRegExp)
				{
					regExpString += "(" + token.content + ")";
					nextCapturingGroupIndex += 1 + token.capturingGroupQty;
				}
				else // if (token instanceof ParsedField)
				{
					token.isArray = this.isMulti;
					token.index = nextCapturingGroupIndex;
					this.fields.push( token);
					regExpString += this.generateRegExpSectionForField( token);
					nextCapturingGroupIndex++;
					if (token.matchPattern)
						nextCapturingGroupIndex += 1 + token.matchPattern.capturingGroupQty;
				}
			}
		}

		this.regExp = new RegExp( regExpString, caseSensitive ? "" : "i");
	}



	// Returns a string with the regular expression group for the given field.
	private generateRegExpSectionForField( parsedField: ParsedField): string
	{
		let s = "";
		if (parsedField.matchPattern && parsedField.matchPattern.content)
		{
			s += parsedField.matchPattern.content;
			if (parsedField.isOptional)
				s += "?";
		}
		else if (parsedField.isOptional)
			s += "(.*)";
		else
			s += "(.+)";

		// s += ")";
		return s;
	}
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The ParsedText class defines a single text section within a segment.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
class ParsedText extends ParsedToken
{
	// Text section string
	content: string;

	constructor()
	{
		super();
		this.content = "";
	}

	parse( textEndChars: string): void
	{
		let s: string = "";
		while( !g_isEnd() && textEndChars.indexOf( g_currChar) < 0)
		{
			s += g_currChar;
			g_move();
		}

		if (!isValidTextToken( s))
			throw new UrlPatternParsingException( `Text token '${s}' contains invalid characters`);

		// text might have been URL encoded
		try
		{
			this.content = decodeURIComponent(s);
		}
		catch( err)
		{
			throw new UrlPatternParsingException( `Text token '${s}' cannot be URL-decoded. Error: ${err.message}`);
		}

		this.finalize();
	}
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The ParsedRegExp class defines a single regular expression section within a segment or
// field.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
class ParsedRegExp extends ParsedToken
{
	// Regular expression string
	content: string;

	// Number of capturing groups within the regular expression
	capturingGroupQty: number;

	constructor()
	{
		super();
		this.content = "";
		this.capturingGroupQty = 0;
	}

	/**
	 * Parses regular expression. This method is called when the current character is '('
	 */
	public parse(): void
	{
		// Stack of opening and closing characters (parenthesis, brackets and curly braces) for
		// parsing regular expressions section. Regular expression section stops when we encounter
		// character ')' and this stack is empty.
		let stack: string[] = [];

		while( !g_isEnd())
		{
			let currChar = g_currChar;
			if (currChar === ')')
			{
				if (stack.pop() === '(')
				{
					g_move();
					if (stack.length === 0)
					{
						this.content += currChar;
						this.finalize();
						return;
					}
				}
				else
					throw new UrlPatternParsingException( `Non-matching character '${currChar}' in regular expression`);
			}
			else if (currChar === '}')
			{
				if (stack.pop() === '{')
					g_move();
				else
					throw new UrlPatternParsingException( `Non-matching character '${currChar}' in regular expression`);
			}
			else if (currChar === ']')
			{
				if (stack.pop() === '[')
					g_move();
				else
					throw new UrlPatternParsingException( `Non-matching character '${currChar}' in regular expression`);
			}
			else if ("({[".indexOf( currChar) >= 0)
			{
				if (currChar === '(')
					this.capturingGroupQty++;

				stack.push( currChar);
				g_move();
			}
			else if (currChar === '\\')
			{
				this.content += currChar;
				g_move();
				g_checkEnd( `In the Regexp '${this.content}', the escape character '\\' must be followed by another character`);
				currChar = g_currChar;
				g_move();
			}
			else
				g_move();

			this.content += currChar;
		}

		// we end up here only if the URL pattern ended while within unfinished regular expression
		throw new UrlPatternParsingException( `Invalid URL pattern end within regular expression`);
	}

	public finalize(): void
	{
		if (!this.content)
			throw new UrlPatternParsingException( `Empty regular expression`);

		super.finalize();
	}
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The ParsedField class defines a single field within a segment.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
class ParsedField extends ParsedToken implements api.IParsedField
{
	// Flag indicating whether the field is optional
	isOptional: boolean;

	// Name of the field.
	name: string;

	// Field FieldFormat
	format: api.FieldFormat;

	/** Optional default value of the field */
	defaultValue: api.FieldValueType;

	// Flag indicating whether the field value is an array. This is true for fields that can appear
	// multiple times in the URL part.
	isArray: boolean;

	// Index of the regular expression capturing group corresponding to the field within the
	// segment.
	index: number;

	// Regular expression string describing the matching pattern for the field
	matchPattern: ParsedRegExp;

	constructor()
	{
		super();

		this.isOptional = false;
		this.name = "";
		this.format = api.FieldFormat.String;
		this.matchPattern = null;
	}

	/**
	 * Parses regulafield. This method is called when the current character is '{'
	 */
	public parse( segmentEndChars: string): void
	{
		// skip '{'
		g_move();
		g_checkEnd( `A field must define a name`);

		// first check whether this field is optional
		if (g_currChar === '?')
		{
			this.isOptional = true;
			g_move();
		}

		// loop over characters in the field name
		while( !g_isEnd())
		{
			if (segmentEndChars.indexOf( g_currChar) >= 0)
				throw new UrlPatternParsingException( `Field doesn't have closing '}'`);
			else if ("}(%=".indexOf(g_currChar) >= 0)
				break;
			else
			{
				this.name += g_currChar;
				g_move();
			}
		}

		if (this.name.length === 0)
			throw new UrlPatternParsingException( `Field must have name`);
		else if (!isValidFieldName( this.name))
			throw new UrlPatternParsingException( `Field name '${this.name}' contains invalid characters`);

		g_checkEnd( `Field '${this.name}' doesn't have closing '}'`);

		// field may define format
		if (g_currChar === '%')
		{
			g_move()
			g_checkEnd( `Field '${this.name}' doesn't specify format after '%'`);

			let formatChar = g_currChar;
			if (formatChar === 'i')
			{
				this.format = api.FieldFormat.Integer;
				g_move();
			}
			else if (formatChar === 'f')
			{
				this.format = api.FieldFormat.Float;
				g_move();
			}
			else if (formatChar === 'b')
			{
				this.format = api.FieldFormat.Boolean;
				g_move();
			}
			else
				throw new UrlPatternParsingException( `Field '${this.name}' has invalid format character '${g_currChar}'`);

			g_checkEnd( `Field '${this.name}' doesn't have closing '}'`);
		}

		// field may have regular expression
		if (g_currChar === '(')
		{
			let regExp = new ParsedRegExp();
			regExp.parse();
			this.matchPattern = regExp;

			g_checkEnd( `Field '${this.name}' doesn't have closing '}'`);
		}

		// field may have default value: in this case it becomes optional
		if (g_currChar === '=')
		{
			this.isOptional = true;
			g_move();
			this.parseDefaultValue( segmentEndChars);
		}
		else
		{
			switch( this.format)
			{
				case api.FieldFormat.Integer: this.defaultValue = NaN; break;
				case api.FieldFormat.Float: this.defaultValue = NaN; break;
				case api.FieldFormat.Boolean: this.defaultValue = undefined; break;
				default: this.defaultValue = ""; break;
			}
		}

		if (g_currChar === '}')
		{
			this.finalize();
			g_move();
		}
		else
			throw new UrlPatternParsingException( `Field '${this.name}' has invalid character '${g_currChar}'`);
	}

	private parseDefaultValue( segmentEndChars: string): void
	{
		let s: string = "";
		while( !g_isEnd())
		{
			if (segmentEndChars.indexOf( g_currChar) >= 0)
				throw new UrlPatternParsingException( `Field '${this.name}' doesn't have closing '}'`);
			else if (g_currChar === '}')
				break;
			else
			{
				s += g_currChar;
				g_move();
			}
		}

		
		// check whether the default value is empty and if field format is set to a non-string
		// also check whether it can be converted to theat format.
		if (!s)
			throw new UrlPatternParsingException( `Field '${this.name}' default value cannot be empty`);

		// default value might have been URL encoded
		s = decodeURIComponent(s);

		if (this.format === api.FieldFormat.Integer)
		{
			this.defaultValue = Number( s);
			if (isNaN( this.defaultValue) || !Number.isInteger( this.defaultValue))
				throw new UrlPatternParsingException( `Default value '${s}' of Integer field '${this.name}' cannot be converted to Integer`);
		}
		else if (this.format === api.FieldFormat.Float)
		{
			this.defaultValue = Number( s);
			if (isNaN( this.defaultValue))
				throw new UrlPatternParsingException( `Default value of '${s}' Float field '${this.name}' cannot be converted to Float`);
		}
		else if (this.format === api.FieldFormat.Boolean)
		{
			let v = s.toLowerCase();
			if (v === "true" || v === "t" || v === "yes" || v === "y" || v === "1")
				this.defaultValue = true;
			else if (v === "false" || v === "f" || v === "no" || v === "n" || v === "0")
				this.defaultValue = false;
			else
				throw new UrlPatternParsingException( `Default value of '${s}' Boolean field '${this.name}' cannot be converted to Boolean`);
		}
		else
			this.defaultValue = s;
	}
}




/**
 * Determines whether the given string is a valid text token in a segement. To be valid, it must
 * be alpha-numeric or undescore '_' or dash '-' or percent sign '%' (for URL-encoded characters).
 * @param s
 */
function isValidTextToken( s: string): boolean
{
	return /^[a-z0-9_\-%]+$/i.test(s);
}



/**
 * Determines whether the given string is a valid field name. To be valid, it must start from the
 * the alpha-numeric or undescore '_' character and be followed by optional alpha-numeric or
 * undescore '_' or dash '-' characters.
 * @param s 
 */
function isValidFieldName( s: string): boolean
{
	return /^[a-z_][a-z0-9_]*$/i.test(s);
}



/**
 * Determines whether the given string is a valid name of a query string parameter.
 * To be valid, it must be alpha-numeric or undescore '_' or dash '-'.
 * @param s
 */
function isValidQueryParamName( s: string): boolean
{
	return /^[a-z0-9_\-]+$/i.test(s);
}



/**
 * Determines whether the given character is a delimiter that cannot be used as text within URL
 * @param c 
 */
function g_isDelimiter( c: string): boolean
{
	return "!@#$%^&*()+=[]{}:;\"'<>,.?/|\\`~".indexOf(c) >= 0;
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The IUrlPatternParsingException interface represents an error that occurred during parsing of
// a URL pattern.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
class UrlPatternParsingException extends Error implements api.IUrlPatternParsingException
{
	// Index in the pattern string at which theerror occurred.
	pos: number;

	constructor( message: string)
	{
		super();
		this.pos = g_currIndex;
		this.message = `Error at position ${this.pos}: ${message}`;
	}
}



