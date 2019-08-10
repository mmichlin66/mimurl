import * as api from "./api"



// Matches the given URL against URL pattern string.
export function match( url: string | api.IParsedActualURL, pattern: string | api.IParsedUrlPattern): api.IUrlPatternMatchResult
{
	if (!url)
		throw new Error( "URL cannot be null or empty string");
	if (!pattern)
		throw new Error( "Pattern cannot be null or empty string");

	if (typeof url === "string")
	{
		if (typeof pattern === "string")
			return matchParsed( api.parseURL( url), api.parseUrlPattern( pattern));
		else
			return matchParsed( api.parseURL( url), pattern);
	}
	else
	{
		if (typeof pattern === "string")
			return matchParsed( url, api.parseUrlPattern( pattern));
		else
			return matchParsed( url, pattern);
	}
}



// Matches the given URL against already parsed URL pattern.
export function matchParsed( parsedURL: api.IParsedActualURL, parsedPattern: api.IParsedUrlPattern): api.IUrlPatternMatchResult
{
	if (!parsedURL)
		throw new Error( "URL cannot be null");
	if (!parsedPattern)
		throw new Error( "parsedPattern cannot be null");

	// prepare object for match result
	let matchResult = new UrlPatternMatchResult();
	matchResult.parsedURL = parsedURL;
	matchResult.fields = {};
	let errors: string[] = [];

	try
	{
		// compare part by part
		let error = matchSingleSegment( api.EUrlPart.Protocol, parsedURL.protocol,
			 			parsedPattern.protocol ? parsedPattern.protocol.segment : null, matchResult.fields);
		if (error)
			errors.push( error);

		error = matchMultipleSegments( api.EUrlPart.Hostname, parsedURL.hostname,
						parsedPattern.hostname ? parsedPattern.hostname.segments : null, matchResult.fields);
		if (error)
			errors.push( error);

		error = matchSingleSegment( api.EUrlPart.Port, parsedURL.port,
						parsedPattern.port ? parsedPattern.port.segment : null, matchResult.fields);
		if (error)
			errors.push( error);

		error = matchMultipleSegments( api.EUrlPart.Path, parsedURL.path,
						parsedPattern.path ? parsedPattern.path.segments : null, matchResult.fields);
		if (error)
			errors.push( error);

		error = matchQueryString( parsedURL.query, parsedPattern.query, matchResult.fields);
		if (error)
			errors.push( error);

		error = matchSingleSegment( api.EUrlPart.Hash, parsedURL.hash,
						parsedPattern.hash ? parsedPattern.hash.segment : null, matchResult.fields);
		if (error)
			errors.push( error);
	}
	catch( err)
	{
		errors.push( err.message);
	}

	// if we have errors, put them into the result object
	if (errors.length > 0)
		matchResult.errors = errors;

	return matchResult;
}



// Matches the given string against the given compiled segment. Fields will be added
// to the given result object.
function matchSingleSegment( urlPart: api.EUrlPart, actualSegment: string | number, parsedSegment: api.IParsedSegment,
				 fields: api.FieldBag): string | null
{
	if (typeof actualSegment === "number")
		actualSegment = actualSegment.toString();

	// if compiled segment is NOT provided, then actual segment must be empty
	if (!parsedSegment)
	{
		if (actualSegment)
			return `URL part '${api.EUrlPart[urlPart]}' contains segment '${actualSegment}' that doesn't exist in the pattern`;
		else
			return null;
	}

	// if actual segment is empty and compiled segment is mandatory, there is no match; if string
	// is empty and compiled segment is optional, there is match;
	if (!actualSegment)
	{
		if (parsedSegment.isOptional)
			return null;
		else
			return `URL part '${api.EUrlPart[urlPart]}' doesn't have a segment corresponding ` +
					`to a mandatory pattern segment '${parsedSegment.tokenSting}'`;
	}

	return tryMatchSingleSegment( actualSegment, parsedSegment, fields)
		? null
		: `URL segment '${actualSegment}' in part '${api.EUrlPart[urlPart]}' doesn't match ` +
			`pattern segment '${parsedSegment.tokenSting}'`;
}



// Tries to match actual segment to the compiled segment. If there is a macth, returns a non-null
// object with field values (if no fields found, returns an empty object). If there is no match
// returns null.
function tryMatchSingleSegment( actualSegment: string, parsedSegment: api.IParsedSegment,
	fields: api.FieldBag): boolean
{
	// perform regular expression match - note that the matching part (index 0 of the result) should
	// match our string exactly so that no extra characters are found before or after the match.
	let execResult = parsedSegment.regExp.exec( actualSegment);
	if (!execResult || execResult[0] !== actualSegment)
		return false;

	// check whether we have any fields
	for( let parsedField of parsedSegment.fields)
	{
		// check whether regular expression result has this index and get the value
		if (parsedField.index >= execResult.length)
		{
			console.error(`BUG: Field index not found in patter's regular expression execution result`);
			return false;
		}

		let value = convertFieldValue( parsedField, execResult[parsedField.index]);
		if (!parsedField.isArray)
			fields[parsedField.name] = value;
		else
		{
			let arr = fields[parsedField.name] as api.MultiFieldValueType;
			if (arr === undefined)
			{
				arr = [];
				fields[parsedField.name] = arr;
			}

			arr.push( value);
		}
	}

	return true;
}



// Matches the given string array against the given compiled segment array. Fields will be added
// to the given result object.
function matchMultipleSegments( urlPart: api.EUrlPart, actualSegments: string[], parsedSegments: api.IParsedSegment[],
	fields: api.FieldBag): string | null
{
	if (!actualSegments && !parsedSegments)
		return null;
	else if (!actualSegments)
		return `URL doesn't have part '${api.EUrlPart[urlPart]}' that exists in the pattern`;
	else if (!parsedSegments)
		return `URL has part '${api.EUrlPart[urlPart]}' that doesn't exist in the pattern`;

	// For each parsed segment we create a compiled segment except in one case: for "one or more"
	// parsed segments we create two compiled segment - one single mandatory and one multi and
	// optional.
	let compiledSegments: CompiledSegment[] = [];
	for( let parsedSegment of parsedSegments)
	{
		if (parsedSegment.isMulti && !parsedSegment.isOptional)
		{
			compiledSegments.push( new CompiledSegment( parsedSegment, false));
			compiledSegments.push( new CompiledSegment( parsedSegment, true));
		}
		else
			compiledSegments.push( new CompiledSegment( parsedSegment, parsedSegment.isOptional));
	}

	// call recursive function that will return the object with field values if there is a match
	// or null if there is not.
	if (tryMatchMultipleSegments( actualSegments, 0, compiledSegments, 0, fields))
		return null;
	else
		return `URL part '${api.EUrlPart[urlPart]}' doesn't match the pattern`;
}



// Tries to match actual segments to the pattern starting from the given index in each array. If
// there is a macth, returns a non-null object with field values (if no fields found, returns an
// empty object). If there is no match returns null.
function tryMatchMultipleSegments( actualSegments: string[], actualStartIndex: number,
				compiledSegments: CompiledSegment[], compiledStartIndex: number,
				fields: api.FieldBag): boolean
{
	// loop over compiled segments. If the segment is mandatory, we compare it to the actual
	// segment and if there is no match, the matching fails. If the segment is optional, we call
	// this function recursively starting from the next compiled segment. If this call returns
	// null (no match), then we map the actual segment to the compiled segment and advance the
	// indices.
	let actualCurrIndex = actualStartIndex;
	let compiledCurrIndex = compiledStartIndex;
	while( compiledCurrIndex < compiledSegments.length && actualCurrIndex < actualSegments.length)
	{
		let compiledSegment = compiledSegments[compiledCurrIndex];
		let actualSegment = actualSegments[actualCurrIndex];
		if (!compiledSegment.isOptional)
		{
			// compare mandatory segment with the actual one
			if (tryMatchSingleSegment( actualSegment, compiledSegment.parsedSegment, fields))
			{
				compiledCurrIndex++;
				actualCurrIndex++;
			}
			else
				return false;
		}
		else
		{
			// recursively call this function passing the next compiled segment index
			let tempFields: api.FieldBag = {}
			if (tryMatchMultipleSegments( actualSegments, actualCurrIndex,
				compiledSegments, compiledCurrIndex + 1, tempFields))
			{
				// there is a match
				mergeFields( fields, tempFields);
				return true;
			}
			else
			{
				// clear temporary fields that might have been filled by the previous (failed)
				// call to tryMatchMultipleSegments.
				tempFields = {};

				// compare this segment with the actual one
				if (tryMatchSingleSegment( actualSegment, compiledSegment.parsedSegment, tempFields))
				{
					// copy field values and advance the actual index
					mergeFields( fields, tempFields);
					actualCurrIndex++;

					// advance the compiled index only if this field is a singular one
					if (!compiledSegment.parsedSegment.isMulti)
						compiledCurrIndex++;
				}
				else
					return false;
			}
		}
	}

	// we are here if either compile segments or actual segments or both are exhosted. If both
	// are exhosted, there is a match. If compiled are exhosted but actual are not, there is no
	// match. If actual are exhosted but compiled are not, there is match only if all the
	// remaining compiled segments are optional.
	if (compiledCurrIndex === compiledSegments.length && actualCurrIndex === actualSegments.length)
		return true;
	else if (compiledCurrIndex === compiledSegments.length)
		return false;
	else
	{
		for( let i = compiledCurrIndex; i < compiledSegments.length; i++)
		{
			let compiledSegment = compiledSegments[i];
			if (!compiledSegment.isOptional)
				return false;
		}

		return true;
	}
}



// Matches the given string object against the given compiled query string. Fields will be added
// to the given result object.
function matchQueryString( actualQuery: { [P: string]: string[] }, parsedQuery: api.IParsedQueryString,
				 fields: api.FieldBag): string | null
{
	if (!parsedQuery)
		return null;
	else if (!actualQuery)
	{
		if (Object.keys( parsedQuery.parsedQSPs).length === 0)
			return null;
		else
			return `URL doesn't have query string parameters specified in the pattern`;
	}

	// go over query string parameters specified in the patter. If there is any non-optional
	// parameter that doesn't exist in the actual URL, we fail the match.
	for( let qspName in parsedQuery.parsedQSPs)
	{
		if (actualQuery[qspName] === undefined)
			return `URL doesn't have query string parameter '${qspName}'`;
	}

	// go over query string parameters in the actual URL
	for( let qspName in actualQuery)
	{
		// find this name in the pattern. If the pattern doesn't specify this parameter and the
		// pattern doesn't allow for extra parameters, then there is no match. Otherwise, this
		// parameter is simply ignored.
		let parsedSegment = parsedQuery.parsedQSPs[qspName].segment;
		if (!parsedSegment)
		{
			if (!parsedQuery.allowExtraQueryParams)
				return `URL has query string parameter '${qspName}' that is not specified in the pattern`;
		}
		else
		{
			// for singular segment the parameter must be present only once
			let qspValues = actualQuery[qspName];
			if (!parsedSegment.isMulti && qspValues.length > 1)
				return `URL has multiple values for query string parameter '${qspName}' while pattern doesn't specify it as multi`;

			for( let qspValue of qspValues)
			{
				if (!tryMatchSingleSegment( qspValue, parsedSegment, fields))
					return `URL's query string parameter '${qspName}' doesn't match that specified in the pattern`;
			}
		}
	}

	return null;
}



// Merges field values from the source object to the target one.
function mergeFields( target: { [P: string]: api.FieldValueType }, source: { [P: string]: api.FieldValueType }): void
{
	for( let fieldName in source)
	{
		let sourceVal = source[fieldName];
		let targetVal = target[fieldName];
		if (targetVal === undefined)
			target[fieldName] = sourceVal;
		else
		{
			// both source and target values must be arrays
			let sourceArr = sourceVal as api.MultiFieldValueType;
			let targetArr = targetVal as api.MultiFieldValueType;
			for( let sourceItem of sourceArr)
				targetArr.push( sourceItem);
		}
	}
}



// Returns field value converted to the required format
function convertFieldValue( parsedField: api.IParsedField, stringValue: string): api.SingleFieldValueType
{
	if (!stringValue)
		return parsedField.defaultValue as api.SingleFieldValueType;

	switch( parsedField.format)
	{
		case api.FieldFormat.Integer:
		{
			let v = Number( stringValue);
			return isNaN(v) || !Number.isInteger(v) ? parsedField.defaultValue as number : v;
		}

		case api.FieldFormat.Float:
		{
			let v = Number( stringValue);
			return isNaN(v) ? parsedField.defaultValue as number : v;
		}

		case api.FieldFormat.Boolean:
		{
			let v = stringValue.toLowerCase();
			if (v === "true" || v === "t" || v === "yes" || v === "y" || v === "1")
				return true;
			else if (v === "false" || v === "f" || v === "no" || v === "n" || v === "0")
				return false;
			else
				return parsedField.defaultValue as boolean;
		}

		default:
			return stringValue;
	}
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The CompiledSegment interface represents a regular expression that should be compared to a
// segment from the actual URL part. Compiled segment contains the regular expression and a flag
// indicating whether this segment is optional.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
class CompiledSegment
{
	// Reference to the parsed segment object.
	parsedSegment: api.IParsedSegment;

	// Flag indicating whether this segment is optional. For each "one-or-more" parsed segements
	// we create two compiled segments: the first is mandatory and the second is optional. That's
	// why we have thie isOptional flag here.
	isOptional: boolean;

	constructor( parsedSegment: api.IParsedSegment, isOptional: boolean)
	{
		this.parsedSegment = parsedSegment;
		this.isOptional = isOptional;
	}
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The UrlPatternMatchResult class describes the result of matching a URL to a pattern.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
class UrlPatternMatchResult implements api.IUrlPatternMatchResult
{
	/** Flag indicating whether the match was successul */
	public get success(): boolean { return !this.errors || this.errors.length === 0; }

	/** Parsed actual URL */
	parsedURL: api.IParsedActualURL;

	/** Error object in case the match was not successful */
	public errors: string[];

	/** Field names and values */
	public fields: api.FieldBag;
}



